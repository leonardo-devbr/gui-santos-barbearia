import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { AdminBarberError, createAdminBarber } from '@/lib/admin-barbers'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do barbeiro em JSON.', 400)

  try {
    const barber = await createAdminBarber(body)
    return NextResponse.json({ barber, message: 'Barbeiro criado com sucesso.' }, { status: 201 })
  } catch (error) {
    if (error instanceof AdminBarberError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
