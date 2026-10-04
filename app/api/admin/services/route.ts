import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminServiceError, createAdminService } from '@/lib/admin-services'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do serviço em JSON.', 400)

  try {
    const service = await createAdminService(body)
    return NextResponse.json({ service, message: 'Serviço criado com sucesso.' }, { status: 201 })
  } catch (error) {
    if (error instanceof AdminServiceError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
