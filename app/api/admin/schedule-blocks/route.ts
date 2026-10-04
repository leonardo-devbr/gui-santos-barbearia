import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import {
  AdminScheduleBlockError,
  createAdminScheduleBlock,
} from '@/lib/admin-schedule-blocks'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do bloqueio em JSON.', 400)

  try {
    const block = await createAdminScheduleBlock(body)
    return NextResponse.json({ block, message: 'Período bloqueado com sucesso.' }, { status: 201 })
  } catch (error) {
    if (error instanceof AdminScheduleBlockError) return errorResponse(error.message, error.status)
    return internalErrorResponse(error)
  }
}
