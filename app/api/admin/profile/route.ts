import { NextResponse } from 'next/server'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  BarberProfileError,
  getCurrentBarberProfile,
  updateCurrentBarberProfile,
} from '@/lib/barber-profile'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'

export async function GET() {
  try {
    return NextResponse.json({ profile: await getCurrentBarberProfile() })
  } catch (error) {
    if (error instanceof BarberProfileError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do perfil em JSON.', 400)

  try {
    const staff = await getAuthenticatedStaff()
    if (!staff) return errorResponse('Faça login para continuar.', 401)
    if (staff.role !== 'barber') {
      return errorResponse('Este perfil está disponível apenas para barbeiros.', 403)
    }

    if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
      const rateLimit = await consumeRateLimits([
        {
          action: 'barber-profile-password-staff',
          identifier: staff.id,
          limit: 8,
          windowSeconds: 15 * 60,
        },
        {
          action: 'barber-profile-password-ip',
          identifier: getClientIdentifier(request),
          limit: 30,
          windowSeconds: 15 * 60,
        },
      ])
      if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)
    }

    const result = await updateCurrentBarberProfile(body)
    return NextResponse.json({
      ...result,
      message: result.passwordChanged
        ? 'Perfil e senha atualizados com sucesso.'
        : 'Perfil profissional atualizado com sucesso.',
    })
  } catch (error) {
    if (error instanceof BarberProfileError) {
      return errorResponse(
        error.message,
        error.status,
        error.field ? { [error.field]: error.message } : undefined,
      )
    }
    return internalErrorResponse(error)
  }
}
