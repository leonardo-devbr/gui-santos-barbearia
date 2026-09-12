import { NextResponse } from 'next/server'

export async function readJsonObject(request: Request) {
  try {
    const value: unknown = await request.json()

    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Record<string, unknown>
  } catch {
    return null
  }
}

export function errorResponse(message: string, status: number, errors?: Record<string, string>) {
  return NextResponse.json(errors ? { message, errors } : { message }, { status })
}

export function internalErrorResponse(error: unknown) {
  console.error(error)
  return errorResponse('Não foi possível concluir a solicitação. Tente novamente mais tarde.', 500)
}
