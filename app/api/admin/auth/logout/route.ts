import { NextResponse } from 'next/server'
import { destroyStaffSession } from '@/lib/admin-auth'
import { internalErrorResponse } from '@/lib/api'

export async function POST() {
  try {
    await destroyStaffSession()
    return NextResponse.json({ message: 'Sessão administrativa encerrada.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
