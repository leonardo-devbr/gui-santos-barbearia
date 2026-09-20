import { randomUUID } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { createToken, hashPassword, hashToken } from '@/lib/auth'
import { withTransaction } from '@/lib/db'
import {
  canExposeDevelopmentVerificationUrl,
  cleanupExpiredEmailVerifications,
  createEmailVerificationUrl,
  EMAIL_VERIFICATION_MAX_AGE_MS,
  sendEmailVerification,
} from '@/lib/email-verification'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'
import {
  getPasswordError,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
} from '@/lib/validation'

type RegistrationField = 'name' | 'phone' | 'email' | 'password'

interface ExistingCustomerRow extends RowDataPacket {
  id: string
  email: string
  email_verified_at: string | null
  pending_email: string | null
  registration_token_hash: string | null
}

interface CreatedCustomer {
  id: string
  name: string
  email: string
}

const successMessage =
  'Se o endereço puder ser cadastrado, enviaremos um link para confirmar e ativar a conta.'

function validateRegistration(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const rawPhone = typeof body.phone === 'string' ? body.phone : ''
  const phoneDigits = rawPhone.replace(/\D/g, '')
  const phone = normalizePhone(rawPhone)
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const errors: Partial<Record<RegistrationField, string>> = {}

  if (name.length < 3) errors.name = 'Informe seu nome completo.'
  else if (name.length > 80) errors.name = 'O nome deve ter no máximo 80 caracteres.'

  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    errors.phone = 'Informe um telefone com DDD.'
  }

  if (!isValidEmail(email) || email.length > 254) errors.email = 'Informe um e-mail válido.'

  const passwordError = getPasswordError(password)
  if (passwordError) errors.password = passwordError

  return { data: { name, phone, email, password }, errors }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do cadastro em JSON.', 400)

  const { data, errors } = validateRegistration(body)
  if (Object.keys(errors).length > 0) {
    return errorResponse('Revise os campos destacados para continuar.', 422, errors)
  }

  try {
    const rateLimit = await consumeRateLimits([
      {
        action: 'customer-register-email',
        identifier: data.email,
        limit: 3,
        windowSeconds: 60 * 60,
      },
      {
        action: 'customer-register-ip',
        identifier: getClientIdentifier(request),
        limit: 10,
        windowSeconds: 60 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const passwordHash = await hashPassword(data.password)
    const token = createToken()
    const tokenHash = hashToken(token)
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_MAX_AGE_MS)
    const verificationUrl = createEmailVerificationUrl(token, request.url)

    const customer = await withTransaction<CreatedCustomer | null>(async (connection) => {
      await cleanupExpiredEmailVerifications(connection)

      const [existingCustomers] = await connection.execute<ExistingCustomerRow[]>(
        `SELECT
           customers.id,
           customers.email,
           customers.email_verified_at,
           customers.pending_email,
           email_verification_tokens.token_hash AS registration_token_hash
         FROM customers
         LEFT JOIN email_verification_tokens
           ON email_verification_tokens.customer_id = customers.id
          AND email_verification_tokens.purpose = 'registration'
         WHERE customers.email = ? OR customers.pending_email = ?
         FOR UPDATE`,
        [data.email, data.email],
      )
      const currentAccount = existingCustomers.find((row) => row.email === data.email)
      const pendingOwner = existingCustomers.find((row) => row.pending_email === data.email)

      if (
        pendingOwner ||
        currentAccount?.email_verified_at ||
        (currentAccount && !currentAccount.registration_token_hash)
      ) {
        return null
      }
      if (currentAccount) {
        await connection.execute<ResultSetHeader>('DELETE FROM customers WHERE id = ?', [
          currentAccount.id,
        ])
      }

      const id = randomUUID()
      await connection.execute<ResultSetHeader>(
        'INSERT INTO customers (id, name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)',
        [id, data.name, data.phone, data.email, passwordHash],
      )
      await connection.execute<ResultSetHeader>(
        `INSERT INTO email_verification_tokens
          (token_hash, customer_id, email, purpose, expires_at)
         VALUES (?, ?, ?, 'registration', ?)`,
        [tokenHash, id, data.email, expiresAt],
      )

      return { id, name: data.name, email: data.email }
    })

    if (customer) {
      after(async () => {
        try {
          await sendEmailVerification({
            customerName: customer.name,
            email: customer.email,
            verificationUrl,
            purpose: 'registration',
          })
        } catch (error) {
          console.error('Falha ao enviar confirmação de cadastro:', error)
        }
      })
    }

    return NextResponse.json(
      {
        message: successMessage,
        developmentVerificationUrl:
          customer && canExposeDevelopmentVerificationUrl(request.url)
            ? verificationUrl
            : undefined,
      },
      { status: 201 },
    )
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return NextResponse.json({ message: successMessage }, { status: 201 })
    }

    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
