import { NextResponse } from 'next/server'
import { authenticateAdmin } from '@/lib/admin-auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
  resetRateLimit,
} from '@/lib/rate-limit'
import { isValidEmail, MAX_PASSWORD_LENGTH, normalizeEmail } from '@/lib/validation'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie suas credenciais em JSON.', 400)

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!isValidEmail(email) || !password || password.length > MAX_PASSWORD_LENGTH) {
    return errorResponse('Informe um e-mail e uma senha válidos.', 422)
  }

  try {
    const rateLimit = await consumeRateLimits([
      {
        action: 'admin-login-email',
        identifier: email,
        limit: 5,
        windowSeconds: 15 * 60,
      },
      {
        action: 'admin-login-ip',
        identifier: getClientIdentifier(request),
        limit: 15,
        windowSeconds: 15 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    if (!(await authenticateAdmin(email, password))) {
      return errorResponse('E-mail ou senha incorretos.', 401)
    }

    await resetRateLimit('admin-login-email', email)
    return NextResponse.json({ message: 'Acesso administrativo autorizado.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
