import { NextResponse } from 'next/server'

const MAX_JSON_BODY_BYTES = 16 * 1024

export async function readJsonObject(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  if (contentType !== 'application/json') return null

  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) return null
  if (!request.body) return null

  try {
    const reader = request.body.getReader()
    const decoder = new TextDecoder()
    let totalBytes = 0
    let body = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > MAX_JSON_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()

    const value: unknown = JSON.parse(body)

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
