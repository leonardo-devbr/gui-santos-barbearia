import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import {
  AdminAppointmentError,
  getAdminAppointments,
} from '@/lib/admin-appointments'
import { isValidIsoDate } from '@/lib/date'

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date')?.trim() ?? ''
  if (date && !isValidIsoDate(date)) return errorResponse('Informe uma data válida.', 422)

  try {
    return NextResponse.json({ appointments: await getAdminAppointments(date || undefined) })
  } catch (error) {
    if (error instanceof AdminAppointmentError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
