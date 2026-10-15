import { NextResponse } from 'next/server'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
import { getStaffNotifications, markAllStaffNotificationsRead, markStaffNotificationRead } from '@/lib/staff-notifications'

export async function GET() {
  try {
    if (!(await getAuthenticatedStaff())) return errorResponse('Acesso da equipe não autorizado.', 401)
    return NextResponse.json(await getStaffNotifications())
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie a ação em JSON.', 400)

  try {
    if (!(await getAuthenticatedStaff())) return errorResponse('Acesso da equipe não autorizado.', 401)

    if (body.all === true) {
      const updated = await markAllStaffNotificationsRead()
      return NextResponse.json({ updated })
    }

    if (typeof body.id !== 'string' || !body.id || body.id.length > 64) {
      return errorResponse('Notificação inválida.', 422)
    }

    const updated = await markStaffNotificationRead(body.id)
    if (!updated) return errorResponse('Notificação não encontrada.', 404)
    return NextResponse.json({ updated: true })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
