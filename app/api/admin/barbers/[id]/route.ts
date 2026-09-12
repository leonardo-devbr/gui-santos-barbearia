import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminBarberError, updateAdminBarber } from '@/lib/admin-barbers'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do barbeiro em JSON.', 400)

  try {
    const { id } = await context.params
    const barber = await updateAdminBarber(id, body)
    return NextResponse.json({ barber, message: 'Barbeiro atualizado com sucesso.' })
  } catch (error) {
    if (error instanceof AdminBarberError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
