import { NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { hashPassword, hashToken } from '@/lib/auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { withTransaction } from '@/lib/db'
import { getPasswordError } from '@/lib/validation'

interface ResetTokenRow extends RowDataPacket {
  customer_id: string
}

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados da nova senha em JSON.', 400)

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const errors: Partial<Record<'password', string>> = {}
  const passwordError = getPasswordError(password)

  if (passwordError) errors.password = passwordError
  if (!token || token.length > 256) return errorResponse('O link de recuperação é inválido ou expirou.', 422)
  if (Object.keys(errors).length > 0) {
    return errorResponse('Revise os campos destacados para continuar.', 422, errors)
  }

  try {
    const passwordHash = await hashPassword(password)
    const changed = await withTransaction(async (connection) => {
      const [rows] = await connection.execute<ResetTokenRow[]>(
        `SELECT customer_id
         FROM password_reset_tokens
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
         FOR UPDATE`,
        [hashToken(token)],
      )
      const resetToken = rows[0]
      if (!resetToken) return false

      await connection.execute<ResultSetHeader>(
        'UPDATE customers SET password_hash = ? WHERE id = ?',
        [passwordHash, resetToken.customer_id],
      )
      await connection.execute<ResultSetHeader>(
        'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE token_hash = ?',
        [hashToken(token)],
      )
      await connection.execute<ResultSetHeader>('DELETE FROM sessions WHERE customer_id = ?', [
        resetToken.customer_id,
      ])
      return true
    })

    if (!changed) return errorResponse('O link de recuperação é inválido ou expirou.', 422)
    return NextResponse.json({ message: 'Senha redefinida com sucesso.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
