import { after, NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { createToken, hashToken } from '@/lib/auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { getBusinessConfiguration } from '@/lib/business'
import { getPool, withTransaction } from '@/lib/db'
import { getPublicAppUrl, sendEmail } from '@/lib/email'
import { createPasswordResetEmail } from '@/lib/email-templates'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'
import { isValidEmail, normalizeEmail } from '@/lib/validation'

interface CustomerIdRow extends RowDataPacket {
  id: string
  name: string
  email: string
}

const successMessage =
  'Se houver uma conta vinculada ao endereço informado, as instruções de recuperação serão enviadas.'

function canExposeDevelopmentResetUrl(request: Request) {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.DEV_EXPOSE_PASSWORD_RESET_URL !== 'true') return false

  try {
    const hostname = new URL(request.url).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

async function waitForMinimumResponseTime(startedAt: number) {
  const remaining = 600 - (Date.now() - startedAt)
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie o e-mail em JSON.', 400)

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  if (!isValidEmail(email) || email.length > 254) {
    return errorResponse('Informe um e-mail válido.', 422, { email: 'Informe um e-mail válido.' })
  }

  try {
    const rateLimit = await consumeRateLimits([
      {
        action: 'password-recovery-email',
        identifier: email,
        limit: 3,
        windowSeconds: 30 * 60,
      },
      {
        action: 'password-recovery-ip',
        identifier: getClientIdentifier(request),
        limit: 10,
        windowSeconds: 30 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const token = createToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    const customer = await withTransaction<CustomerIdRow | null>(async (connection) => {
      const [rows] = await connection.execute<CustomerIdRow[]>(
        `SELECT id, name, email
         FROM customers
         WHERE email = ? AND email_verified_at IS NOT NULL
         LIMIT 1
         FOR UPDATE`,
        [email],
      )
      const currentCustomer = rows[0]
      if (!currentCustomer) return null

      await connection.execute<ResultSetHeader>(
        'DELETE FROM password_reset_tokens WHERE customer_id = ? OR expires_at <= UTC_TIMESTAMP()',
        [currentCustomer.id],
      )
      await connection.execute<ResultSetHeader>(
        'INSERT INTO password_reset_tokens (token_hash, customer_id, expires_at) VALUES (?, ?, ?)',
        [hashToken(token), currentCustomer.id, expiresAt],
      )
      return currentCustomer
    })

    if (!customer) {
      await waitForMinimumResponseTime(startedAt)
      return NextResponse.json({ message: successMessage })
    }

    const resetUrl = `${getPublicAppUrl(request.url)}/redefinir-senha?token=${encodeURIComponent(token)}`
    const developmentResetUrl = canExposeDevelopmentResetUrl(request) ? resetUrl : undefined

    after(async () => {
      try {
        const { settings } = await getBusinessConfiguration()
        const emailMessage = createPasswordResetEmail({
          customerName: customer.name,
          resetUrl,
          businessName: settings.name,
        })
        await sendEmail({ to: customer.email, ...emailMessage })
      } catch (error) {
        console.error('Falha ao enviar e-mail de recuperação:', error)
        await getPool().execute<ResultSetHeader>(
          'DELETE FROM password_reset_tokens WHERE token_hash = ?',
          [hashToken(token)],
        )
      }
    })

    await waitForMinimumResponseTime(startedAt)
    return NextResponse.json({ message: successMessage, developmentResetUrl })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
