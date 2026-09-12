import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { ResultSetHeader } from 'mysql2/promise'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { hashPassword } from '@/lib/auth'
import { getPool } from '@/lib/db'
import {
  getPasswordError,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
} from '@/lib/validation'

type RegistrationField = 'name' | 'phone' | 'email' | 'password'

function validateRegistration(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : ''
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const errors: Partial<Record<RegistrationField, string>> = {}

  if (name.length < 3) errors.name = 'Informe seu nome completo.'
  else if (name.length > 80) errors.name = 'O nome deve ter no máximo 80 caracteres.'

  if (phone.length < 10 || phone.length > 11) errors.phone = 'Informe um telefone com DDD.'

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
    const passwordHash = await hashPassword(data.password)
    await getPool().execute<ResultSetHeader>(
      'INSERT INTO customers (id, name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), data.name, data.phone, data.email, passwordHash],
    )

    return NextResponse.json({ message: 'Conta criada com sucesso.' }, { status: 201 })
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return errorResponse('Já existe uma conta com este e-mail.', 409, {
        email: 'Este e-mail já está cadastrado.',
      })
    }

    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
