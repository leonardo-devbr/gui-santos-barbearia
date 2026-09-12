import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  AdminAppointmentError,
  updateAdminAppointmentStatus,
} from '@/lib/admin-appointments'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie o novo estado em JSON.', 400)

  const status = body.status
  if (status !== 'concluido' && status !== 'cancelado') {
    return errorResponse('O estado informado não é permitido.', 422)
  }

  try {
    const { id } = await context.params
    if (!id || id.length > 64) return errorResponse('Agendamento não encontrado.', 404)

    await updateAdminAppointmentStatus(id, status)
    return NextResponse.json({ message: 'Agendamento atualizado com sucesso.' })
  } catch (error) {
    if (error instanceof AdminAppointmentError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
