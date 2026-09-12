import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminUserError, createAdminUser } from '@/lib/admin-users'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do administrador em JSON.', 400)

  try {
    const user = await createAdminUser(body)
    return NextResponse.json({ user, message: 'Administrador criado com sucesso.' }, { status: 201 })
  } catch (error) {
    if (error instanceof AdminUserError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
