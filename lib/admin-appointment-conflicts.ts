import 'server-only'

import type { PoolConnection, RowDataPacket } from 'mysql2/promise'
import { getNowInSaoPaulo } from '@/lib/date'
import { formatDateShort } from '@/lib/format'
import type { BusinessHour } from '@/lib/types'

interface AppointmentConflictRow extends RowDataPacket {
  id: string
  appointment_date: string
  appointment_time: string
  barber_name: string
}

export interface AppointmentConflict {
  id: string
  date: string
  time: string
  barberName: string
}

function getFutureParameters() {
  const now = getNowInSaoPaulo()
  return [now.date, now.date, `${now.time}:00`] as const
}

const activeFutureClause = `
  appointments.status IN ('confirmado', 'pendente')
  AND (
    appointments.appointment_date > ?
    OR (
      appointments.appointment_date = ?
      AND TIME_TO_SEC(appointments.appointment_time) + appointments.duration_minutes * 60 > TIME_TO_SEC(?)
    )
  )`

function mapConflict(row: AppointmentConflictRow): AppointmentConflict {
  return {
    id: row.id,
    date: row.appointment_date,
    time: row.appointment_time.slice(0, 5),
    barberName: row.barber_name,
  }
}

export function summarizeAppointmentConflicts(conflicts: AppointmentConflict[]) {
  const visible = conflicts.slice(0, 5).map(
    (conflict) =>
      `${formatDateShort(conflict.date)} às ${conflict.time} (${conflict.barberName})`,
  )
  return `${visible.join(', ')}${conflicts.length > 5 ? ' e outros horários' : ''}`
}

// Os chamadores já travam o barbeiro ou o expediente, que também são travados por
// criação e remarcação. Estas leituras permanecem sem FOR UPDATE para não inverter
// a ordem de locks das remarcações, que começam pelo próprio agendamento.
export async function findAppointmentConflictsForScheduleBlock(
  connection: PoolConnection,
  input: {
    barberId: string | null
    date: string
    startTime: string | null
    endTime: string | null
  },
) {
  const parameters: Array<string> = [input.date, ...getFutureParameters()]
  const barberClause = input.barberId ? 'AND barber_id = ?' : ''
  if (input.barberId) parameters.push(input.barberId)

  const timeClause =
    input.startTime && input.endTime
      ? `AND TIME_TO_SEC(appointment_time) < TIME_TO_SEC(?)
         AND TIME_TO_SEC(appointment_time) + duration_minutes * 60 > TIME_TO_SEC(?)`
      : ''
  if (input.startTime && input.endTime) {
    parameters.push(`${input.endTime}:00`, `${input.startTime}:00`)
  }

  const [rows] = await connection.execute<AppointmentConflictRow[]>(
    `SELECT
       appointments.id,
       appointments.appointment_date,
       appointments.appointment_time,
       barbers.name AS barber_name
     FROM appointments
     INNER JOIN barbers ON barbers.id = appointments.barber_id
     WHERE appointments.appointment_date = ?
       AND ${activeFutureClause}
       ${barberClause}
       ${timeClause}
     ORDER BY appointments.appointment_time ASC, barbers.name ASC
     LIMIT 6`,
    parameters,
  )

  return rows.map(mapConflict)
}

export async function findFutureAppointmentsForBarber(
  connection: PoolConnection,
  barberId: string,
) {
  const [rows] = await connection.execute<AppointmentConflictRow[]>(
    `SELECT
       appointments.id,
       appointments.appointment_date,
       appointments.appointment_time,
       barbers.name AS barber_name
     FROM appointments
     INNER JOIN barbers ON barbers.id = appointments.barber_id
     WHERE appointments.barber_id = ?
       AND ${activeFutureClause}
     ORDER BY appointments.appointment_date ASC, appointments.appointment_time ASC
     LIMIT 6`,
    [barberId, ...getFutureParameters()],
  )

  return rows.map(mapConflict)
}

export async function findAppointmentsOutsideBusinessHour(
  connection: PoolConnection,
  hour: BusinessHour,
) {
  const parameters: Array<string | number> = [...getFutureParameters(), hour.weekday]
  const timeClause = hour.isOpen
    ? `AND (
         appointments.appointment_time < ?
         OR TIME_TO_SEC(appointments.appointment_time) + appointments.duration_minutes * 60 > TIME_TO_SEC(?)
       )`
    : ''
  if (hour.isOpen) {
    parameters.push(`${hour.openTime}:00`, `${hour.closeTime}:00`)
  }

  const [rows] = await connection.execute<AppointmentConflictRow[]>(
    `SELECT
       appointments.id,
       appointments.appointment_date,
       appointments.appointment_time,
       barbers.name AS barber_name
     FROM appointments
     INNER JOIN barbers ON barbers.id = appointments.barber_id
     WHERE ${activeFutureClause}
       AND DAYOFWEEK(appointments.appointment_date) - 1 = ?
       ${timeClause}
     ORDER BY appointments.appointment_date ASC, appointments.appointment_time ASC, barbers.name ASC
     LIMIT 6`,
    parameters,
  )

  return rows.map(mapConflict)
}
