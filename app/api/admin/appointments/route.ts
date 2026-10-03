import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import {
  AdminAppointmentError,
  getAdminAppointments,
  getAdminAppointmentsForPeriod,
} from '@/lib/admin-appointments'
import { isValidIsoDate } from '@/lib/date'

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const date = searchParams.get('date')?.trim() ?? ''
  const startDate = searchParams.get('from')?.trim() ?? ''
  const endDate = searchParams.get('to')?.trim() ?? ''
  const barberId = searchParams.get('barber')?.trim() ?? ''
  if (date && !isValidIsoDate(date)) return errorResponse('Informe uma data válida.', 422)
  if ((startDate || endDate) && (!isValidIsoDate(startDate) || !isValidIsoDate(endDate))) {
    return errorResponse('Informe o início e o fim válidos para o período.', 422)
  }

  try {
    return NextResponse.json({
      appointments:
        startDate && endDate
          ? await getAdminAppointmentsForPeriod(startDate, endDate, barberId || undefined)
          : await getAdminAppointments(date || undefined, barberId || undefined),
    })
  } catch (error) {
    if (error instanceof AdminAppointmentError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
