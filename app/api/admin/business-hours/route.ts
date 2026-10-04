import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminBusinessError, updateAdminBusinessHours } from '@/lib/admin-business'

export async function PUT(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os horários em JSON.', 400)

  try {
    const hours = await updateAdminBusinessHours(body)
    return NextResponse.json({ hours, message: 'Horários de funcionamento atualizados.' })
  } catch (error) {
    if (error instanceof AdminBusinessError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
