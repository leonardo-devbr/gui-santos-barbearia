import { NextResponse } from 'next/server'
import { MAX_BARBER_PHOTO_BYTES } from '@/lib/barber-photo'
import { BarberPhotoError, saveAdminBarberPhoto } from '@/lib/barber-photos'
import { errorResponse, internalErrorResponse } from '@/lib/api'

interface RouteContext {
  params: Promise<{ id: string }>
}

const MAX_MULTIPART_BYTES = MAX_BARBER_PHOTO_BYTES + 64 * 1024

export async function POST(request: Request, context: RouteContext) {
  const contentType = request.headers.get('content-type') ?? ''
  const contentLength = Number(request.headers.get('content-length'))
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return errorResponse('Envie a foto como formulário de arquivo.', 415)
  }
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
    return errorResponse('Escolha uma imagem de até 5 MB.', 413)
  }

  try {
    const formData = await request.formData()
    const file = formData.get('photo')
    if (!(file instanceof File)) return errorResponse('Escolha uma foto para importar.', 422)

    const { id } = await context.params
    const result = await saveAdminBarberPhoto(id, new Uint8Array(await file.arrayBuffer()))
    return NextResponse.json({ ...result, message: 'Foto atualizada com sucesso.' })
  } catch (error) {
    if (error instanceof BarberPhotoError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
