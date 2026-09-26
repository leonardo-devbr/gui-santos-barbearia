import 'server-only'

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
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
  barber_id: string
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

async function requireStaffAccess() {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new AdminAppointmentError('Acesso da equipe não autorizado.', 401)
  if (staff.role === 'barber' && !staff.barberId) {
    throw new AdminAppointmentError('Esta conta não está vinculada a um barbeiro.', 403)
  }
  return staff
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

export async function getAdminAppointments(
  date = getTodayInSaoPaulo(),
  requestedBarberId?: string,
) {
  const staff = await requireStaffAccess()
  if (requestedBarberId && requestedBarberId.length > 64) {
    throw new AdminAppointmentError('Barbeiro inválido.', 422)
  }
  const barberId = staff.role === 'barber' ? staff.barberId : requestedBarberId
  const barberClause = barberId ? 'AND appointments.barber_id = ?' : ''
  const parameters = barberId ? [date, barberId] : [date]

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
      ${barberClause}
    ORDER BY appointments.appointment_time ASC`,
    parameters,
  )

  return rows.map(mapAppointment)
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const staff = await requireStaffAccess()
  const today = getTodayInSaoPaulo()
  const barberClause = staff.role === 'barber' ? 'WHERE barber_id = ?' : ''
  const parameters: string[] = [today, today, today, today, today, today]
  if (staff.role === 'barber') parameters.push(staff.barberId!)

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
    FROM appointments
    ${barberClause}`,
    parameters,
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
  const staff = await requireStaffAccess()

  return withTransaction(async (connection) => {
    const barberClause = staff.role === 'barber' ? 'AND barber_id = ?' : ''
    const parameters = staff.role === 'barber' ? [appointmentId, staff.barberId!] : [appointmentId]
    const [rows] = await connection.execute<AppointmentStatusRow[]>(
      `SELECT status, barber_id
       FROM appointments
       WHERE id = ? ${barberClause}
       LIMIT 1
       FOR UPDATE`,
      parameters,
    )
    const appointment = rows[0]

    if (!appointment) throw new AdminAppointmentError('Agendamento não encontrado.', 404)
    if (appointment.status === nextStatus) return false
    if (appointment.status === 'concluido' || appointment.status === 'cancelado') {
      throw new AdminAppointmentError('Este atendimento já foi finalizado.', 409)
    }

    await connection.execute<ResultSetHeader>('UPDATE appointments SET status = ? WHERE id = ?', [
      nextStatus,
      appointmentId,
    ])
    return true
  })
}
