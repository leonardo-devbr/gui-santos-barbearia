import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { AppointmentError, getAvailability } from '@/lib/appointments'
import { getAuthenticatedCustomer } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para consultar horários.', 401)

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
