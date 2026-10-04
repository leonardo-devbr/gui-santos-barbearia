import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import {
  AdminScheduleBlockError,
  deleteAdminScheduleBlock,
} from '@/lib/admin-schedule-blocks'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    await deleteAdminScheduleBlock(id)
    return NextResponse.json({ message: 'Bloqueio removido com sucesso.' })
  } catch (error) {
    if (error instanceof AdminScheduleBlockError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
