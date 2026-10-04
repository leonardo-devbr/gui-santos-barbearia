import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { authenticateCustomer } from '@/lib/auth'
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
  const errors: Partial<Record<'email' | 'password', string>> = {}

  if (!isValidEmail(email) || email.length > 254) errors.email = 'Informe um e-mail válido.'
  if (!password) errors.password = 'Informe sua senha.'
  else if (password.length > MAX_PASSWORD_LENGTH) errors.password = 'A senha informada é inválida.'

  if (Object.keys(errors).length > 0) {
    return errorResponse('Revise os campos destacados para continuar.', 422, errors)
  }

  try {
    const rateLimit = await consumeRateLimits([
      {
        action: 'customer-login-email',
        identifier: email,
        limit: 8,
        windowSeconds: 15 * 60,
      },
      {
        action: 'customer-login-ip',
        identifier: getClientIdentifier(request),
        limit: 30,
        windowSeconds: 15 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const authentication = await authenticateCustomer(email, password)
    if (authentication === 'invalid') {
      return errorResponse('E-mail ou senha incorretos.', 401)
    }
    if (authentication === 'unverified') {
      return errorResponse('Confirme seu e-mail antes de entrar.', 403)
    }

    await resetRateLimit('customer-login-email', email)
    return NextResponse.json({ message: 'Login realizado com sucesso.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
