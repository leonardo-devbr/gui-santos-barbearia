import { NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { createSession, verifyPassword } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { isValidEmail, MAX_PASSWORD_LENGTH, normalizeEmail } from '@/lib/validation'

interface LoginRow extends RowDataPacket {
  id: string
  password_hash: string
}

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie suas credenciais em JSON.', 400)

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const errors: Partial<Record<'email' | 'password', string>> = {}

  if (!isValidEmail(email) || email.length > 254) errors.email = 'Informe um e-mail válido.'
  if (!password) errors.password = 'Informe sua senha.'
  else if (password.length > MAX_PASSWORD_LENGTH) errors.password = 'A senha informada é inválida.'

  if (Object.keys(errors).length > 0) {
    return errorResponse('Revise os campos destacados para continuar.', 422, errors)
  }

  try {
    const [rows] = await getPool().execute<LoginRow[]>(
      'SELECT id, password_hash FROM customers WHERE email = ? LIMIT 1',
      [email],
    )
    const customer = rows[0]

    if (!customer || !(await verifyPassword(password, customer.password_hash))) {
      return errorResponse('E-mail ou senha incorretos.', 401)
    }

    await createSession(customer.id)
    return NextResponse.json({ message: 'Login realizado com sucesso.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
