import { NextResponse } from 'next/server'
import { internalErrorResponse } from '@/lib/api'
import { getBarbers } from '@/lib/catalog'

export async function GET() {
  try {
    return NextResponse.json({ barbers: await getBarbers() })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
