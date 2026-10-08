import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { internalErrorResponse } from '@/lib/api'
import { processAppointmentNotifications } from '@/lib/email-notifications'
import { processWhatsAppNotifications } from '@/lib/whatsapp-notifications'

export const runtime = 'nodejs'

function hasValidAuthorization(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''

  if (!secret || Buffer.byteLength(secret, 'utf8') < 32 || !token) return false

  const expected = Buffer.from(secret)
  const received = Buffer.from(token)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export async function POST(request: Request) {
  if (!hasValidAuthorization(request)) {
    return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const [email, whatsapp] = await Promise.all([
      processAppointmentNotifications(),
      processWhatsAppNotifications(),
    ])
    return NextResponse.json({ ...email, email, whatsapp })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
