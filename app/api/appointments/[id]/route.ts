import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  AppointmentError,
  cancelAppointment,
  rescheduleAppointment,
  validateAppointmentInput,
} from '@/lib/appointments'
import { getAuthenticatedCustomer } from '@/lib/auth'
import { notifyAppointment } from '@/lib/email-notifications'
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
  if (!body) return errorResponse('Envie os dados do agendamento em JSON.', 400)

  const input = validateAppointmentInput(body)
  if (!input) return errorResponse('Revise o serviço, barbeiro, data e horário.', 422)

  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para remarcar um horário.', 401)

    const rateLimit = await consumeRateLimits([
      {
        action: 'appointment-reschedule-customer',
        identifier: customer.id,
        limit: 10,
        windowSeconds: 60 * 60,
      },
      {
        action: 'appointment-reschedule-ip',
        identifier: getClientIdentifier(request),
        limit: 30,
        windowSeconds: 60 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const { id } = await context.params
    if (!id || id.length > 64) return errorResponse('Agendamento não encontrado.', 404)

    const changed = await rescheduleAppointment(customer.id, id, input)
    if (changed) await notifyAppointment(id, 'appointment_rescheduled')
    return NextResponse.json({
      message: changed ? 'Agendamento remarcado com sucesso.' : 'O agendamento já está atualizado.',
    })
  } catch (error) {
    if (error instanceof AppointmentError) return errorResponse(error.message, error.status)
    if (isDuplicateEntry(error)) return errorResponse('Este horário já foi reservado.', 409)
    return internalErrorResponse(error)
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para cancelar um horário.', 401)

    const rateLimit = await consumeRateLimits([
      {
        action: 'appointment-cancel-customer',
        identifier: customer.id,
        limit: 20,
        windowSeconds: 60 * 60,
      },
      {
        action: 'appointment-cancel-ip',
        identifier: getClientIdentifier(request),
        limit: 60,
        windowSeconds: 60 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const { id } = await context.params
    if (!id || id.length > 64) return errorResponse('Agendamento não encontrado.', 404)

    await cancelAppointment(customer.id, id)
    await notifyAppointment(id, 'appointment_cancelled')
    return NextResponse.json({ message: 'Agendamento cancelado com sucesso.' })
  } catch (error) {
    if (error instanceof AppointmentError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
