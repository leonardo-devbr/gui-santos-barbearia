import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminUserError, updateAdminUser } from '@/lib/admin-users'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do administrador em JSON.', 400)

  try {
    const { id } = await context.params
    const result = await updateAdminUser(id, body)
    return NextResponse.json({ ...result, message: 'Administrador atualizado com sucesso.' })
  } catch (error) {
    if (error instanceof AdminUserError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
