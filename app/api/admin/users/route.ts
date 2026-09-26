import { NextResponse } from 'next/server'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminUserError, createStaffAccount } from '@/lib/admin-users'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do administrador em JSON.', 400)

  try {
    const admin = await getAuthenticatedStaff()
    if (!admin) return errorResponse('Acesso administrativo não autorizado.', 401)
    if (admin.role !== 'admin') return errorResponse('Acesso administrativo necessário.', 403)

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

    const user = await createStaffAccount(body)
    return NextResponse.json({ user, message: 'Acesso criado com sucesso.' }, { status: 201 })
  } catch (error) {
    if (error instanceof AdminUserError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
