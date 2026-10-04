import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

function getExpectedOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',', 1)[0].trim()
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',', 1)[0].trim()
  const host = forwardedHost || request.headers.get('host')
  const protocol = forwardedProtocol || request.nextUrl.protocol.slice(0, -1)

  return host ? `${protocol}://${host}` : request.nextUrl.origin
}

export function proxy(request: NextRequest) {
  if (safeMethods.has(request.method)) return NextResponse.next()

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    return NextResponse.json({ message: 'Origem da requisição não permitida.' }, { status: 403 })
  }

  const origin = request.headers.get('origin')
  if (origin && origin !== getExpectedOrigin(request)) {
    return NextResponse.json({ message: 'Origem da requisição não permitida.' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
