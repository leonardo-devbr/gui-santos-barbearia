import { after, NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  createToken,
  getCurrentCustomerSessionTokenHash,
  getAuthenticatedCustomer,
  hashToken,
  verifyPassword,
} from '@/lib/auth'
import { getTodayInSaoPaulo, isValidIsoDate } from '@/lib/date'
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
import { isValidEmail, MAX_PASSWORD_LENGTH, normalizeEmail, normalizePhone } from '@/lib/validation'

type ProfileField =
  | 'name'
  | 'phone'
  | 'email'
  | 'birthDate'
  | 'preferredCut'
  | 'beardStyle'
  | 'notes'
  | 'currentPassword'

interface IdRow extends RowDataPacket {
  id: string
}

interface ProfileAuthenticationRow extends RowDataPacket {
  password_hash: string
}

function validateProfile(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const rawPhone = typeof body.phone === 'string' ? body.phone : ''
  const phoneDigits = rawPhone.replace(/\D/g, '')
  const phone = normalizePhone(rawPhone)
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : ''
  const preferredCut = typeof body.preferredCut === 'string' ? body.preferredCut.trim() : ''
  const beardStyle = typeof body.beardStyle === 'string' ? body.beardStyle.trim() : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
  const errors: Partial<Record<ProfileField, string>> = {}

  if (name.length < 3) errors.name = 'Informe seu nome completo.'
  else if (name.length > 80) errors.name = 'O nome deve ter no máximo 80 caracteres.'

  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    errors.phone = 'Informe um telefone com DDD.'
  }
  if (!isValidEmail(email) || email.length > 254) errors.email = 'Informe um e-mail válido.'

  if (birthDate && (!isValidIsoDate(birthDate) || birthDate > getTodayInSaoPaulo())) {
    errors.birthDate = 'Informe uma data de nascimento válida.'
  }

  if (preferredCut.length > 100) errors.preferredCut = 'Use no máximo 100 caracteres.'
  if (beardStyle.length > 100) errors.beardStyle = 'Use no máximo 100 caracteres.'
  if (notes.length > 500) errors.notes = 'Use no máximo 500 caracteres.'
  if (currentPassword.length > MAX_PASSWORD_LENGTH) {
    errors.currentPassword = 'A senha atual informada é inválida.'
  }

  return {
    data: { name, phone, email, birthDate, preferredCut, beardStyle, notes, currentPassword },
    errors,
  }
}

export async function GET() {
  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para continuar.', 401)
    return NextResponse.json({ customer })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do perfil em JSON.', 400)

  const { data, errors } = validateProfile(body)
  if (Object.keys(errors).length > 0) {
    return errorResponse('Revise os campos destacados para continuar.', 422, errors)
  }

  try {
    const customer = await getAuthenticatedCustomer()
    const sessionTokenHash = await getCurrentCustomerSessionTokenHash()
    if (!customer || !sessionTokenHash) return errorResponse('Faça login para continuar.', 401)
    const emailChanged = data.email !== customer.email

    if (emailChanged) {
      const rateLimit = await consumeRateLimits([
        {
          action: 'profile-email-customer',
          identifier: customer.id,
          limit: 5,
          windowSeconds: 15 * 60,
        },
        {
          action: 'profile-email-ip',
          identifier: getClientIdentifier(request),
          limit: 15,
          windowSeconds: 15 * 60,
        },
      ])
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    }

    let verificationUrl: string | undefined
    let tokenHash: string | undefined
    let expiresAt: Date | undefined

    if (emailChanged) {
      const token = createToken()
      tokenHash = hashToken(token)
      expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_MAX_AGE_MS)
      verificationUrl = createEmailVerificationUrl(token, request.url)
    }

    await withTransaction(async (connection) => {
      await cleanupExpiredEmailVerifications(connection)
      const [authenticationRows] = await connection.execute<ProfileAuthenticationRow[]>(
        `SELECT customers.password_hash
         FROM sessions
         INNER JOIN customers ON customers.id = sessions.customer_id
         WHERE sessions.token_hash = ?
           AND sessions.customer_id = ?
           AND sessions.expires_at > UTC_TIMESTAMP()
         LIMIT 1
         FOR UPDATE`,
        [sessionTokenHash, customer.id],
      )
      const authentication = authenticationRows[0]
      if (!authentication) throw new Error('CUSTOMER_SESSION_INVALID')

      if (
        emailChanged &&
        (!data.currentPassword ||
          !(await verifyPassword(data.currentPassword, authentication.password_hash)))
      ) {
        throw new Error('CUSTOMER_PASSWORD_INVALID')
      }

      if (emailChanged) {
        const [duplicates] = await connection.execute<IdRow[]>(
          `SELECT id
           FROM customers
           WHERE id <> ? AND (email = ? OR pending_email = ?)
           LIMIT 1
           FOR UPDATE`,
          [customer.id, data.email, data.email],
        )
        if (duplicates[0]) {
          throw new Error('CUSTOMER_EMAIL_DUPLICATE')
        }
      }

      const profileValues = [
        data.name,
        data.phone,
        data.birthDate || null,
        data.preferredCut,
        data.beardStyle,
        data.notes,
      ]
      if (emailChanged) {
        await connection.execute<ResultSetHeader>(
          `UPDATE customers
           SET name = ?, phone = ?, birth_date = ?, preferred_cut = ?, beard_style = ?, notes = ?,
               pending_email = ?
           WHERE id = ?`,
          [...profileValues, data.email, customer.id],
        )
      } else {
        await connection.execute<ResultSetHeader>(
          `UPDATE customers
           SET name = ?, phone = ?, birth_date = ?, preferred_cut = ?, beard_style = ?, notes = ?
           WHERE id = ?`,
          [...profileValues, customer.id],
        )
      }

      if (emailChanged && tokenHash && expiresAt) {
        await connection.execute<ResultSetHeader>(
          `DELETE FROM email_verification_tokens
           WHERE customer_id = ? AND purpose = 'email_change'`,
          [customer.id],
        )
        await connection.execute<ResultSetHeader>(
          `INSERT INTO email_verification_tokens
            (token_hash, customer_id, email, purpose, expires_at)
           VALUES (?, ?, ?, 'email_change', ?)`,
          [tokenHash, customer.id, data.email, expiresAt],
        )
      }
    })

    if (emailChanged && verificationUrl) {
      after(async () => {
        try {
          await sendEmailVerification({
            customerName: data.name,
            email: data.email,
            verificationUrl,
            purpose: 'email_change',
          })
        } catch (error) {
          console.error('Falha ao enviar confirmação do novo e-mail:', error)
        }
      })
    }

    return NextResponse.json({
      message: emailChanged
        ? 'Perfil atualizado. Confirme o novo endereço pelo link enviado por e-mail.'
        : 'Perfil atualizado com sucesso.',
      emailVerificationRequired: emailChanged,
      developmentVerificationUrl:
        emailChanged && verificationUrl && canExposeDevelopmentVerificationUrl(request.url)
          ? verificationUrl
          : undefined,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CUSTOMER_SESSION_INVALID') {
      return errorResponse('Sua sessão expirou. Entre novamente para continuar.', 401)
    }
    if (error instanceof Error && error.message === 'CUSTOMER_PASSWORD_INVALID') {
      return errorResponse('Confirme sua senha atual para alterar o e-mail.', 422, {
        currentPassword: 'A senha atual não confere.',
      })
    }
    if (error instanceof Error && error.message === 'CUSTOMER_EMAIL_DUPLICATE') {
      return errorResponse('Já existe uma conta com este e-mail.', 409, {
        email: 'Este e-mail já está sendo usado por outra conta.',
      })
    }
    if (isDuplicateEntry(error)) {
      return errorResponse('Já existe uma conta com este e-mail.', 409, {
        email: 'Este e-mail já está sendo usado por outra conta.',
      })
    }

    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
