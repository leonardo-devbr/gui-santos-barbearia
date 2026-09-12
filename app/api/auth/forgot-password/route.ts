import { NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { createToken, hashToken } from '@/lib/auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { getPool } from '@/lib/db'
import { isValidEmail, normalizeEmail } from '@/lib/validation'

interface CustomerIdRow extends RowDataPacket {
  id: string
}

const successMessage =
  'Se houver uma conta vinculada ao endereço informado, as instruções de recuperação serão enviadas.'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie o e-mail em JSON.', 400)

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  if (!isValidEmail(email) || email.length > 254) {
    return errorResponse('Informe um e-mail válido.', 422, { email: 'Informe um e-mail válido.' })
  }

  try {
    const pool = getPool()
    const [rows] = await pool.execute<CustomerIdRow[]>(
      'SELECT id FROM customers WHERE email = ? LIMIT 1',
      [email],
    )
    const customer = rows[0]

    if (!customer) return NextResponse.json({ message: successMessage })

    const token = createToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await pool.execute<ResultSetHeader>(
      'DELETE FROM password_reset_tokens WHERE customer_id = ? OR expires_at <= UTC_TIMESTAMP()',
      [customer.id],
    )
    await pool.execute<ResultSetHeader>(
      'INSERT INTO password_reset_tokens (token_hash, customer_id, expires_at) VALUES (?, ?, ?)',
      [hashToken(token), customer.id, expiresAt],
    )

    const developmentResetUrl =
      process.env.NODE_ENV === 'production'
        ? undefined
        : `${new URL(request.url).origin}/redefinir-senha?token=${encodeURIComponent(token)}`

    if (developmentResetUrl) console.info(`Link de recuperação local: ${developmentResetUrl}`)

    return NextResponse.json({ message: successMessage, developmentResetUrl })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
