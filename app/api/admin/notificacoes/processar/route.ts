import { NextResponse } from 'next/server'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { processWhatsAppNotifications } from '@/lib/whatsapp-notifications'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const staff = await getAuthenticatedStaff()
    if (!staff) return errorResponse('Faça login como administrador para continuar.', 401)
    if (staff.role !== 'admin') {
      return errorResponse('Apenas administradores podem processar os avisos.', 403)
    }

    const rateLimit = await consumeRateLimits([
      {
        action: 'admin-whatsapp-process-staff',
        identifier: staff.id,
        limit: 5,
        windowSeconds: 60,
      },
      {
        action: 'admin-whatsapp-process-ip',
        identifier: getClientIdentifier(request),
        limit: 15,
        windowSeconds: 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const result = await processWhatsAppNotifications()
    const message =
      result.processed > 0
        ? `${result.processed} aviso(s) processado(s). A lista foi atualizada.`
        : 'Nenhum aviso pendente estava pronto para envio.'

    return NextResponse.json(
      { result, message },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return internalErrorResponse(error)
  }
}
