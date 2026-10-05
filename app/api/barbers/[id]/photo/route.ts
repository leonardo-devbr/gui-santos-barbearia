import { BarberPhotoError, getBarberPhoto } from '@/lib/barber-photos'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const photo = await getBarberPhoto(id)

    if (request.headers.get('if-none-match') === photo.etag) {
      return new Response(null, { status: 304, headers: { ETag: photo.etag } })
    }

    return new Response(photo.bytes, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Type': photo.mime,
        ETag: photo.etag,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof BarberPhotoError) {
      return new Response(error.message, {
        status: error.status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    console.error(error)
    return new Response('Não foi possível carregar a foto.', { status: 500 })
  }
}
