import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  AppointmentError,
  createAppointment,
  getAppointments,
  validateAppointmentInput,
} from '@/lib/appointments'
import { getAuthenticatedCustomer } from '@/lib/auth'
import { notifyAppointment } from '@/lib/email-notifications'
import {
  consumeRateLimits,
  getClientIdentifier,
  rateLimitResponse,
} from '@/lib/rate-limit'

export async function GET(request: Request) {
  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para ver seus agendamentos.', 401)

    const scope = new URL(request.url).searchParams.get('scope') === 'history' ? 'history' : 'upcoming'
    return NextResponse.json({ appointments: await getAppointments(customer.id, scope) })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do agendamento em JSON.', 400)

  const input = validateAppointmentInput(body)
  if (!input) return errorResponse('Revise o serviço, barbeiro, data e horário.', 422)

  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para agendar um horário.', 401)

    const rateLimit = await consumeRateLimits([
      {
        action: 'appointment-create-customer',
        identifier: customer.id,
        limit: 10,
        windowSeconds: 60 * 60,
      },
      {
        action: 'appointment-create-ip',
        identifier: getClientIdentifier(request),
        limit: 30,
        windowSeconds: 60 * 60,
      },
    ])
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit.retryAfter)

    const id = await createAppointment(customer.id, input)
    await notifyAppointment(id, 'appointment_created')
    return NextResponse.json({ id, message: 'Agendamento confirmado com sucesso.' }, { status: 201 })
  } catch (error) {
    if (error instanceof AppointmentError) return errorResponse(error.message, error.status)
    if (isDuplicateEntry(error)) return errorResponse('Este horário já foi reservado.', 409)
    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
