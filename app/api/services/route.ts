import { NextResponse } from 'next/server'
import { internalErrorResponse } from '@/lib/api'
import { getServices } from '@/lib/catalog'

export async function GET() {
  try {
    return NextResponse.json({ services: await getServices() })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
