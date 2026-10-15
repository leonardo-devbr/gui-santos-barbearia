import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { hashPassword } from '@/lib/auth'
import { withTransaction } from '@/lib/db'
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
}

interface CreatedCustomer {
  id: string
  name: string
  email: string
}

const successMessage = 'Conta criada com sucesso! Você já pode entrar.'

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

  const passwordError = getPasswordError(password, { minLength: 1 })
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

    const customer = await withTransaction<CreatedCustomer | null>(async (connection) => {
      const [existingCustomers] = await connection.execute<ExistingCustomerRow[]>(
        `SELECT id, email, email_verified_at
         FROM customers
         WHERE email = ?
         FOR UPDATE`,
        [data.email],
      )
      const currentAccount = existingCustomers[0]

      if (currentAccount) return null

      const id = randomUUID()
      await connection.execute<ResultSetHeader>(
        `INSERT INTO customers (id, name, phone, email, email_verified_at, password_hash)
         VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
        [id, data.name, data.phone, data.email, passwordHash],
      )

      return { id, name: data.name, email: data.email }
    })

    return NextResponse.json(
      {
        message: successMessage,
        accountCreated: Boolean(customer),
      },
      { status: 201 },
    )
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return errorResponse('Este e-mail já está cadastrado.', 409)
    }

    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
