import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminServiceError, updateAdminService } from '@/lib/admin-services'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do serviço em JSON.', 400)

  try {
    const { id } = await context.params
    const service = await updateAdminService(id, body)
    return NextResponse.json({ service, message: 'Serviço atualizado com sucesso.' })
  } catch (error) {
    if (error instanceof AdminServiceError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
