import 'server-only'

import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
import { getPool } from '@/lib/db'
import type { StaffNotification, StaffNotificationType } from '@/lib/types'

interface StaffNotificationRow extends RowDataPacket {
  id: string
  appointment_id: string | null
  notification_type: StaffNotificationType
  title: string
  message: string
  read_at: Date | string | null
  created_at: Date | string
}

function mapNotification(row: StaffNotificationRow): StaffNotification {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    type: row.notification_type,
    title: row.title,
    message: row.message,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function createStaffAppointmentNotification(
  appointmentId: string,
  type: Extract<StaffNotificationType, 'appointment_created' | 'appointment_cancelled' | 'appointment_reminder'>,
) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT
      staff_users.id AS staff_user_id,
      appointments.id AS appointment_id,
      customers.name AS customer_name,
      services.name AS service_name,
      appointments.appointment_date,
      appointments.appointment_time
     FROM appointments
     INNER JOIN customers ON customers.id = appointments.customer_id
     INNER JOIN services ON services.id = appointments.service_id
     INNER JOIN staff_users ON staff_users.barber_id = appointments.barber_id
     WHERE appointments.id = ?
       AND staff_users.role = 'barber'
       AND staff_users.is_active = TRUE
     LIMIT 1`,
    [appointmentId],
  )
  const appointment = rows[0] as (RowDataPacket & {
    staff_user_id: string
    appointment_id: string
    customer_name: string
    service_name: string
    appointment_date: string
    appointment_time: string
  }) | undefined
  if (!appointment) return null

  const labels = {
    appointment_created: {
      title: 'Novo agendamento',
      message: `${appointment.customer_name} agendou ${appointment.service_name} para ${formatNotificationDate(appointment.appointment_date)} às ${appointment.appointment_time.slice(0, 5)}.`,
    },
    appointment_cancelled: {
      title: 'Agendamento cancelado',
      message: `O agendamento de ${appointment.customer_name} para ${formatNotificationDate(appointment.appointment_date)} às ${appointment.appointment_time.slice(0, 5)} foi cancelado.`,
    },
    appointment_reminder: {
      title: 'Próximo atendimento',
      message: `${appointment.customer_name} tem ${appointment.service_name} amanhã às ${appointment.appointment_time.slice(0, 5)}.`,
    },
  }[type]

  const id = randomUUID()
  const dedupeKey = `staff:${appointment.staff_user_id}:${type}:${appointment.id}`
  try {
    await getPool().execute<ResultSetHeader>(
      `INSERT INTO staff_notifications
        (id, staff_user_id, appointment_id, notification_type, title, message, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, appointment.staff_user_id, appointment.appointment_id, type, labels.title, labels.message, dedupeKey],
    )
    return id
  } catch (error) {
    if (isDuplicateEntry(error)) return null
    throw error
  }
}

export async function getStaffNotifications() {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new Error('Acesso da equipe não autorizado.')

  const [rows] = await getPool().execute<StaffNotificationRow[]>(
    `SELECT id, appointment_id, notification_type, title, message, read_at, created_at
     FROM staff_notifications
     WHERE staff_user_id = ?
     ORDER BY created_at DESC
     LIMIT 30`,
    [staff.id],
  )
  const [countRows] = await getPool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS unread_count
     FROM staff_notifications
     WHERE staff_user_id = ? AND read_at IS NULL`,
    [staff.id],
  )

  return {
    notifications: rows.map(mapNotification),
    unreadCount: Number(countRows[0]?.unread_count ?? 0),
  }
}

export async function markStaffNotificationRead(id: string) {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new Error('Acesso da equipe não autorizado.')

  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE staff_notifications
     SET read_at = COALESCE(read_at, UTC_TIMESTAMP())
     WHERE id = ? AND staff_user_id = ?`,
    [id, staff.id],
  )
  return result.affectedRows > 0
}

export async function markAllStaffNotificationsRead() {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new Error('Acesso da equipe não autorizado.')

  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE staff_notifications
     SET read_at = UTC_TIMESTAMP()
     WHERE staff_user_id = ? AND read_at IS NULL`,
    [staff.id],
  )
  return result.affectedRows
}

function formatNotificationDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
