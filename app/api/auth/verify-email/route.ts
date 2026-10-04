import { NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { hashToken } from '@/lib/auth'
import { withTransaction } from '@/lib/db'
import {
  cleanupExpiredEmailVerifications,
  type EmailVerificationPurpose,
} from '@/lib/email-verification'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
  resetRateLimit,
} from '@/lib/rate-limit'

interface VerificationRow extends RowDataPacket {
  customer_id: string
  email: string
  purpose: EmailVerificationPurpose
  current_email: string
  email_verified_at: string | null
  pending_email: string | null
}

interface IdRow extends RowDataPacket {
  id: string
}

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie o token de confirmação em JSON.', 400)

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token || token.length > 256) {
    return errorResponse('O link de confirmação é inválido ou expirou.', 422)
  }

  try {
    const tokenHash = hashToken(token)
    const rateLimit = await consumeRateLimits([
      {
        action: 'email-verification-token',
        identifier: tokenHash,
        limit: 5,
        windowSeconds: 15 * 60,
      },
      {
        action: 'email-verification-ip',
        identifier: getClientIdentifier(request),
        limit: 20,
        windowSeconds: 15 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const purpose = await withTransaction<EmailVerificationPurpose | null>(async (connection) => {
      await cleanupExpiredEmailVerifications(connection)
      const [rows] = await connection.execute<VerificationRow[]>(
        `SELECT
          email_verification_tokens.customer_id,
          email_verification_tokens.email,
          email_verification_tokens.purpose,
          customers.email AS current_email,
          customers.email_verified_at,
          customers.pending_email
         FROM email_verification_tokens
         INNER JOIN customers ON customers.id = email_verification_tokens.customer_id
         WHERE email_verification_tokens.token_hash = ?
           AND email_verification_tokens.expires_at > UTC_TIMESTAMP()
         LIMIT 1
         FOR UPDATE`,
        [tokenHash],
      )
      const verification = rows[0]
      if (!verification) return null

      if (verification.purpose === 'registration') {
        if (verification.current_email !== verification.email || verification.email_verified_at) {
          return null
        }
        await connection.execute<ResultSetHeader>(
          'UPDATE customers SET email_verified_at = UTC_TIMESTAMP() WHERE id = ?',
          [verification.customer_id],
        )
      } else {
        if (verification.pending_email !== verification.email) return null

        const [duplicates] = await connection.execute<IdRow[]>(
          'SELECT id FROM customers WHERE email = ? AND id <> ? LIMIT 1 FOR UPDATE',
          [verification.email, verification.customer_id],
        )
        if (duplicates[0]) throw new Error('EMAIL_NO_LONGER_AVAILABLE')

        await connection.execute<ResultSetHeader>(
          `UPDATE customers
           SET email = ?, email_verified_at = UTC_TIMESTAMP(), pending_email = NULL
           WHERE id = ?`,
          [verification.email, verification.customer_id],
        )
        await connection.execute<ResultSetHeader>(
          'DELETE FROM password_reset_tokens WHERE customer_id = ?',
          [verification.customer_id],
        )
        await connection.execute<ResultSetHeader>('DELETE FROM sessions WHERE customer_id = ?', [
          verification.customer_id,
        ])
      }

      await connection.execute<ResultSetHeader>(
        'DELETE FROM email_verification_tokens WHERE customer_id = ?',
        [verification.customer_id],
      )
      return verification.purpose
    })

    if (!purpose) return errorResponse('O link de confirmação é inválido ou expirou.', 422)

    try {
      await resetRateLimit('email-verification-token', tokenHash)
    } catch (error) {
      console.error('Falha ao limpar limite do token de confirmação:', error)
    }

    return NextResponse.json({
      message:
        purpose === 'registration'
          ? 'E-mail confirmado. Sua conta já está ativa.'
          : 'Novo e-mail confirmado. Entre novamente para continuar.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_NO_LONGER_AVAILABLE') {
      return errorResponse('Este e-mail não está mais disponível.', 409)
    }
    if (isDuplicateEntry(error)) return errorResponse('Este e-mail não está mais disponível.', 409)
    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
