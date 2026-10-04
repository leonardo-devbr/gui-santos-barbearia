import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'
import { internalErrorResponse } from '@/lib/api'

export async function POST() {
  try {
    await destroySession()
    return NextResponse.json({ message: 'Sessão encerrada com sucesso.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
