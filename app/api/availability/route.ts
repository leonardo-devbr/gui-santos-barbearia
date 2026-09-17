import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { AppointmentError, getAvailability } from '@/lib/appointments'
import { getAuthenticatedCustomer } from '@/lib/auth'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'

export async function GET(request: Request) {
  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para consultar horários.', 401)

    const rateLimit = await consumeRateLimits([
      {
        action: 'availability-customer',
        identifier: customer.id,
        limit: 120,
        windowSeconds: 5 * 60,
      },
      {
        action: 'availability-ip',
        identifier: getClientIdentifier(request),
        limit: 300,
        windowSeconds: 5 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const params = new URL(request.url).searchParams
    const serviceId = params.get('serviceId')?.trim() ?? ''
    const barberId = params.get('barberId')?.trim() ?? ''
    const date = params.get('date')?.trim() ?? ''
    const appointmentId = params.get('appointmentId')?.trim() || undefined

    if (!serviceId || serviceId.length > 64 || !barberId || barberId.length > 64) {
      return errorResponse('Selecione um serviço e um barbeiro válidos.', 422)
    }

    const slots = await getAvailability({
      customerId: customer.id,
      appointmentId,
      serviceId,
      barberId,
      date,
    })
    return NextResponse.json({ slots })
  } catch (error) {
    if (error instanceof AppointmentError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
