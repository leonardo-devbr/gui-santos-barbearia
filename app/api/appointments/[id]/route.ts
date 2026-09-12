import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  AppointmentError,
  cancelAppointment,
  rescheduleAppointment,
  validateAppointmentInput,
} from '@/lib/appointments'
import { getAuthenticatedCustomer } from '@/lib/auth'

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

    const { id } = await context.params
    if (!id || id.length > 64) return errorResponse('Agendamento não encontrado.', 404)

    await rescheduleAppointment(customer.id, id, input)
    return NextResponse.json({ message: 'Agendamento remarcado com sucesso.' })
  } catch (error) {
    if (error instanceof AppointmentError) return errorResponse(error.message, error.status)
    if (isDuplicateEntry(error)) return errorResponse('Este horário já foi reservado.', 409)
    return internalErrorResponse(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para cancelar um horário.', 401)

    const { id } = await context.params
    if (!id || id.length > 64) return errorResponse('Agendamento não encontrado.', 404)

    await cancelAppointment(customer.id, id)
    return NextResponse.json({ message: 'Agendamento cancelado com sucesso.' })
  } catch (error) {
    if (error instanceof AppointmentError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
