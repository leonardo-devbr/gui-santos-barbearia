import { NextResponse } from 'next/server'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminUserError, updateAdminUser } from '@/lib/admin-users'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do administrador em JSON.', 400)

  try {
    const admin = await getAuthenticatedAdmin()
    if (!admin) return errorResponse('Acesso administrativo não autorizado.', 401)

    const rateLimit = await consumeRateLimits([
      {
        action: 'admin-user-confirm-admin',
        identifier: admin.id,
        limit: 10,
        windowSeconds: 15 * 60,
      },
      {
        action: 'admin-user-confirm-ip',
        identifier: getClientIdentifier(request),
        limit: 30,
        windowSeconds: 15 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const { id } = await context.params
    const result = await updateAdminUser(id, body)
    return NextResponse.json({ ...result, message: 'Administrador atualizado com sucesso.' })
  } catch (error) {
    if (error instanceof AdminUserError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
