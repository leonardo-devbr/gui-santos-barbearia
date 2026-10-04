import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminBusinessError, updateAdminBusinessSettings } from '@/lib/admin-business'

export async function PATCH(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados da barbearia em JSON.', 400)

  try {
    const settings = await updateAdminBusinessSettings(body)
    return NextResponse.json({ settings, message: 'Dados da barbearia atualizados.' })
  } catch (error) {
    if (error instanceof AdminBusinessError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
