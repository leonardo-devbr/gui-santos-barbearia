import 'server-only'

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { getTodayInSaoPaulo } from '@/lib/date'
import { getPool, withTransaction } from '@/lib/db'
import type { AdminAppointment, AppointmentStatus } from '@/lib/types'

interface AdminAppointmentRow extends RowDataPacket {
  id: string
  service_id: string
  barber_id: string
  service_name: string
  barber_name: string
  customer_name: string
  customer_phone: string
  customer_email: string
  appointment_date: string
  appointment_time: string
  status: AppointmentStatus
  price: number
  duration_minutes: number
}

interface AppointmentStatusRow extends RowDataPacket {
  status: AppointmentStatus
}

interface DashboardRow extends RowDataPacket {
  appointments_today: number
  completed_today: number
  cancelled_today: number
  upcoming_week: number
  revenue_today: number
}

export interface AdminDashboardMetrics {
  appointmentsToday: number
  completedToday: number
  cancelledToday: number
  upcomingWeek: number
  revenueToday: number
}

export class AdminAppointmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function requireAdminAccess() {
  const admin = await getAuthenticatedAdmin()
  if (!admin) throw new AdminAppointmentError('Acesso administrativo não autorizado.', 401)
  return admin
}

function mapAppointment(row: AdminAppointmentRow): AdminAppointment {
  return {
    id: row.id,
    serviceId: row.service_id,
    barberId: row.barber_id,
    serviceName: row.service_name,
    barberName: row.barber_name,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    date: row.appointment_date,
    time: row.appointment_time.slice(0, 5),
    status: row.status,
    price: row.price,
    durationMinutes: row.duration_minutes,
  }
}

export async function getAdminAppointments(date = getTodayInSaoPaulo()) {
  await requireAdminAccess()

  const [rows] = await getPool().execute<AdminAppointmentRow[]>(
    `SELECT
      appointments.id,
      appointments.service_id,
      appointments.barber_id,
      services.name AS service_name,
      barbers.name AS barber_name,
      customers.name AS customer_name,
      customers.phone AS customer_phone,
      customers.email AS customer_email,
      appointments.appointment_date,
      appointments.appointment_time,
      appointments.status,
      appointments.price,
      appointments.duration_minutes
    FROM appointments
    INNER JOIN services ON services.id = appointments.service_id
    INNER JOIN barbers ON barbers.id = appointments.barber_id
    INNER JOIN customers ON customers.id = appointments.customer_id
    WHERE appointments.appointment_date = ?
    ORDER BY appointments.appointment_time ASC`,
    [date],
  )

  return rows.map(mapAppointment)
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  await requireAdminAccess()
  const today = getTodayInSaoPaulo()

  const [rows] = await getPool().execute<DashboardRow[]>(
    `SELECT
      SUM(appointment_date = ? AND status <> 'cancelado') AS appointments_today,
      SUM(appointment_date = ? AND status = 'concluido') AS completed_today,
      SUM(appointment_date = ? AND status = 'cancelado') AS cancelled_today,
      SUM(
        appointment_date >= ?
        AND appointment_date < DATE_ADD(?, INTERVAL 7 DAY)
        AND status IN ('confirmado', 'pendente')
      ) AS upcoming_week,
      COALESCE(SUM(IF(appointment_date = ? AND status = 'concluido', price, 0)), 0) AS revenue_today
    FROM appointments`,
    [today, today, today, today, today, today],
  )
  const row = rows[0]

  return {
    appointmentsToday: Number(row?.appointments_today ?? 0),
    completedToday: Number(row?.completed_today ?? 0),
    cancelledToday: Number(row?.cancelled_today ?? 0),
    upcomingWeek: Number(row?.upcoming_week ?? 0),
    revenueToday: Number(row?.revenue_today ?? 0),
  }
}

export async function updateAdminAppointmentStatus(
  appointmentId: string,
  nextStatus: Extract<AppointmentStatus, 'concluido' | 'cancelado'>,
) {
  await requireAdminAccess()

  await withTransaction(async (connection) => {
    const [rows] = await connection.execute<AppointmentStatusRow[]>(
      'SELECT status FROM appointments WHERE id = ? LIMIT 1 FOR UPDATE',
      [appointmentId],
    )
    const appointment = rows[0]

    if (!appointment) throw new AdminAppointmentError('Agendamento não encontrado.', 404)
    if (appointment.status === nextStatus) return
    if (appointment.status === 'concluido' || appointment.status === 'cancelado') {
      throw new AdminAppointmentError('Este atendimento já foi finalizado.', 409)
    }

    await connection.execute<ResultSetHeader>('UPDATE appointments SET status = ? WHERE id = ?', [
      nextStatus,
      appointmentId,
    ])
  })
}
