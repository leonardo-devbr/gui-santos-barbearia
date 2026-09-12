import 'server-only'

import { randomUUID } from 'node:crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getNowInSaoPaulo, isValidIsoDate, isValidTime } from '@/lib/date'
import { getPool, withTransaction } from '@/lib/db'
import type { Appointment, AppointmentStatus, TimeSlot } from '@/lib/types'

interface AppointmentRow extends RowDataPacket {
  id: string
  service_id: string
  barber_id: string
  service_name: string
  barber_name: string
  appointment_date: string
  appointment_time: string
  status: AppointmentStatus
  price: number
  duration_minutes: number
}

interface ServiceBookingRow extends RowDataPacket {
  id: string
  duration_minutes: number
  price: number
}

interface IdRow extends RowDataPacket {
  id: string
}

interface BusySlotRow extends RowDataPacket {
  appointment_time: string
  duration_minutes: number
}

interface ScheduleBlockRow extends RowDataPacket {
  start_time: string | null
  end_time: string | null
}

interface OwnedAppointmentRow extends RowDataPacket {
  id: string
  barber_id: string
  status: AppointmentStatus
  appointment_date: string
  appointment_time: string
}

export interface AppointmentInput {
  serviceId: string
  barberId: string
  date: string
  time: string
}

export class AppointmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function mapAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    serviceId: row.service_id,
    barberId: row.barber_id,
    serviceName: row.service_name,
    barberName: row.barber_name,
    date: row.appointment_date,
    time: row.appointment_time.slice(0, 5),
    status: row.status,
    price: row.price,
    durationMinutes: row.duration_minutes,
  }
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function getBusinessHours(date: string) {
  const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()

  if (weekday === 0 || weekday === 1) return null
  return { opensAt: 9 * 60, closesAt: weekday === 6 ? 18 * 60 : 20 * 60 }
}

function validateBookingTime(date: string, time: string, durationMinutes: number) {
  if (!isValidIsoDate(date) || !isValidTime(time)) {
    throw new AppointmentError('Informe uma data e um horário válidos.', 422)
  }

  const hours = getBusinessHours(date)
  if (!hours) throw new AppointmentError('A barbearia não abre nesta data.', 422)

  const start = timeToMinutes(time)
  if (start % 30 !== 0 || start < hours.opensAt || start + durationMinutes > hours.closesAt) {
    throw new AppointmentError('O horário escolhido está fora do período de atendimento.', 422)
  }

  const now = getNowInSaoPaulo()
  if (date < now.date || (date === now.date && time <= now.time)) {
    throw new AppointmentError('Escolha um horário futuro.', 422)
  }
}

export function validateAppointmentInput(body: Record<string, unknown>): AppointmentInput | null {
  const serviceId = typeof body.serviceId === 'string' ? body.serviceId.trim() : ''
  const barberId = typeof body.barberId === 'string' ? body.barberId.trim() : ''
  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const time = typeof body.time === 'string' ? body.time.trim() : ''

  if (
    !serviceId ||
    serviceId.length > 64 ||
    !barberId ||
    barberId.length > 64 ||
    !isValidIsoDate(date) ||
    !isValidTime(time)
  ) {
    return null
  }

  return { serviceId, barberId, date, time }
}

export async function getAppointments(customerId: string, scope: 'upcoming' | 'history') {
  const now = getNowInSaoPaulo()
  const scopeClause =
    scope === 'history'
      ? `(appointments.status IN ('concluido', 'cancelado')
         OR appointments.appointment_date < ?
         OR (appointments.appointment_date = ? AND appointments.appointment_time < ?))`
      : `appointments.status IN ('confirmado', 'pendente')
         AND (appointments.appointment_date > ?
         OR (appointments.appointment_date = ? AND appointments.appointment_time >= ?))`
  const direction = scope === 'history' ? 'DESC' : 'ASC'

  const [rows] = await getPool().execute<AppointmentRow[]>(
    `SELECT
      appointments.id,
      appointments.service_id,
      appointments.barber_id,
      services.name AS service_name,
      barbers.name AS barber_name,
      appointments.appointment_date,
      appointments.appointment_time,
      appointments.status,
      appointments.price,
      appointments.duration_minutes
    FROM appointments
    INNER JOIN services ON services.id = appointments.service_id
    INNER JOIN barbers ON barbers.id = appointments.barber_id
    WHERE appointments.customer_id = ? AND ${scopeClause}
    ORDER BY appointments.appointment_date ${direction}, appointments.appointment_time ${direction}`,
    [customerId, now.date, now.date, `${now.time}:00`],
  )

  return rows.map((row) => {
    const appointment = mapAppointment(row)
    const isPast =
      appointment.date < now.date ||
      (appointment.date === now.date && appointment.time < now.time)

    if (scope === 'history' && isPast && appointment.status === 'confirmado') {
      appointment.status = 'concluido'
    }

    return appointment
  })
}

export async function getAvailability({
  customerId,
  appointmentId,
  serviceId,
  barberId,
  date,
}: Omit<AppointmentInput, 'time'> & { customerId: string; appointmentId?: string }) {
  if (!isValidIsoDate(date)) throw new AppointmentError('Informe uma data válida.', 422)

  const pool = getPool()
  const [[serviceRows], [barberRows]] = await Promise.all([
    pool.execute<ServiceBookingRow[]>(
      'SELECT id, duration_minutes, price FROM services WHERE id = ? AND is_active = TRUE LIMIT 1',
      [serviceId],
    ),
    pool.execute<IdRow[]>('SELECT id FROM barbers WHERE id = ? AND is_active = TRUE LIMIT 1', [
      barberId,
    ]),
  ])
  const service = serviceRows[0]

  if (!service || !barberRows[0]) {
    throw new AppointmentError('O serviço ou barbeiro selecionado não está disponível.', 422)
  }

  const hours = getBusinessHours(date)
  if (!hours) return []

  let excludedAppointmentId: string | undefined
  if (appointmentId && appointmentId.length <= 64) {
    const [ownedRows] = await pool.execute<IdRow[]>(
      'SELECT id FROM appointments WHERE id = ? AND customer_id = ? LIMIT 1',
      [appointmentId, customerId],
    )
    excludedAppointmentId = ownedRows[0]?.id
  }

  const parameters: Array<string> = [barberId, date]
  let exclusionClause = ''
  if (excludedAppointmentId) {
    exclusionClause = 'AND id <> ?'
    parameters.push(excludedAppointmentId)
  }

  const [[busySlots], [scheduleBlocks]] = await Promise.all([
    pool.execute<BusySlotRow[]>(
      `SELECT appointment_time, duration_minutes
       FROM appointments
       WHERE barber_id = ?
         AND appointment_date = ?
         AND status IN ('confirmado', 'pendente')
         ${exclusionClause}`,
      parameters,
    ),
    pool.execute<ScheduleBlockRow[]>(
      `SELECT start_time, end_time
       FROM schedule_blocks
       WHERE block_date = ? AND (barber_id = ? OR barber_id IS NULL)`,
      [date, barberId],
    ),
  ])
  const now = getNowInSaoPaulo()
  const slots: TimeSlot[] = []

  for (
    let start = hours.opensAt;
    start + service.duration_minutes <= hours.closesAt;
    start += 30
  ) {
    const time = minutesToTime(start)
    const isFuture = date > now.date || (date === now.date && time > now.time)
    const overlaps = busySlots.some((busySlot) => {
      const busyStart = timeToMinutes(busySlot.appointment_time.slice(0, 5))
      const busyEnd = busyStart + busySlot.duration_minutes
      return start < busyEnd && start + service.duration_minutes > busyStart
    })
    const isBlocked = scheduleBlocks.some((block) => {
      if (!block.start_time || !block.end_time) return true

      const blockStart = timeToMinutes(block.start_time.slice(0, 5))
      const blockEnd = timeToMinutes(block.end_time.slice(0, 5))
      return start < blockEnd && start + service.duration_minutes > blockStart
    })

    slots.push({ time, available: isFuture && !overlaps && !isBlocked })
  }

  return slots
}

async function getBookingResources(connection: PoolConnection, input: AppointmentInput) {
  const [serviceRows] = await connection.execute<ServiceBookingRow[]>(
    'SELECT id, duration_minutes, price FROM services WHERE id = ? AND is_active = TRUE LIMIT 1',
    [input.serviceId],
  )
  const service = serviceRows[0]
  if (!service) throw new AppointmentError('O serviço selecionado não está disponível.', 422)

  const [barberRows] = await connection.execute<IdRow[]>(
    'SELECT id FROM barbers WHERE id = ? AND is_active = TRUE LIMIT 1 FOR UPDATE',
    [input.barberId],
  )
  if (!barberRows[0]) throw new AppointmentError('O barbeiro selecionado não está disponível.', 422)

  validateBookingTime(input.date, input.time, service.duration_minutes)
  return service
}

async function ensureNoConflict(
  connection: PoolConnection,
  input: AppointmentInput,
  durationMinutes: number,
  excludedAppointmentId?: string,
) {
  const parameters: Array<string | number> = [
    input.barberId,
    input.date,
    `${input.time}:00`,
    durationMinutes,
    `${input.time}:00`,
  ]
  let exclusionClause = ''

  if (excludedAppointmentId) {
    exclusionClause = 'AND id <> ?'
    parameters.push(excludedAppointmentId)
  }

  const [conflicts] = await connection.execute<IdRow[]>(
    `SELECT id
     FROM appointments
     WHERE barber_id = ?
       AND appointment_date = ?
       AND status IN ('confirmado', 'pendente')
       AND TIME_TO_SEC(appointment_time) < TIME_TO_SEC(?) + ? * 60
       AND TIME_TO_SEC(appointment_time) + duration_minutes * 60 > TIME_TO_SEC(?)
       ${exclusionClause}
     LIMIT 1
     FOR UPDATE`,
    parameters,
  )

  if (conflicts[0]) {
    throw new AppointmentError('Este horário acabou de ser reservado. Escolha outra opção.', 409)
  }
}

async function ensureNoScheduleBlock(
  connection: PoolConnection,
  input: AppointmentInput,
  durationMinutes: number,
) {
  const [blocks] = await connection.execute<IdRow[]>(
    `SELECT id
     FROM schedule_blocks
     WHERE block_date = ?
       AND (barber_id = ? OR barber_id IS NULL)
       AND (
         (start_time IS NULL AND end_time IS NULL)
         OR (
           TIME_TO_SEC(start_time) < TIME_TO_SEC(?) + ? * 60
           AND TIME_TO_SEC(end_time) > TIME_TO_SEC(?)
         )
       )
     LIMIT 1
     FOR UPDATE`,
    [input.date, input.barberId, `${input.time}:00`, durationMinutes, `${input.time}:00`],
  )

  if (blocks[0]) {
    throw new AppointmentError('O barbeiro não está disponível neste período.', 409)
  }
}

export async function createAppointment(customerId: string, input: AppointmentInput) {
  return withTransaction(async (connection) => {
    const service = await getBookingResources(connection, input)
    await ensureNoScheduleBlock(connection, input, service.duration_minutes)
    await ensureNoConflict(connection, input, service.duration_minutes)

    const id = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO appointments
        (id, customer_id, service_id, barber_id, appointment_date, appointment_time, status, price, duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmado', ?, ?)`,
      [
        id,
        customerId,
        input.serviceId,
        input.barberId,
        input.date,
        `${input.time}:00`,
        service.price,
        service.duration_minutes,
      ],
    )

    return id
  })
}

export async function rescheduleAppointment(
  customerId: string,
  appointmentId: string,
  input: AppointmentInput,
) {
  return withTransaction(async (connection) => {
    const [appointmentRows] = await connection.execute<OwnedAppointmentRow[]>(
      `SELECT id, barber_id, status, appointment_date, appointment_time
       FROM appointments
       WHERE id = ? AND customer_id = ?
       LIMIT 1
       FOR UPDATE`,
      [appointmentId, customerId],
    )
    const appointment = appointmentRows[0]
    if (!appointment) throw new AppointmentError('Agendamento não encontrado.', 404)
    const now = getNowInSaoPaulo()
    const isPast =
      appointment.appointment_date < now.date ||
      (appointment.appointment_date === now.date &&
        appointment.appointment_time.slice(0, 5) <= now.time)
    if (appointment.status === 'cancelado' || appointment.status === 'concluido' || isPast) {
      throw new AppointmentError('Este agendamento não pode mais ser remarcado.', 409)
    }

    const service = await getBookingResources(connection, input)
    await ensureNoScheduleBlock(connection, input, service.duration_minutes)
    await ensureNoConflict(connection, input, service.duration_minutes, appointmentId)

    await connection.execute<ResultSetHeader>(
      `UPDATE appointments
       SET service_id = ?, barber_id = ?, appointment_date = ?, appointment_time = ?,
           status = 'confirmado', price = ?, duration_minutes = ?
       WHERE id = ?`,
      [
        input.serviceId,
        input.barberId,
        input.date,
        `${input.time}:00`,
        service.price,
        service.duration_minutes,
        appointmentId,
      ],
    )
  })
}

export async function cancelAppointment(customerId: string, appointmentId: string) {
  const now = getNowInSaoPaulo()
  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE appointments
     SET status = 'cancelado'
     WHERE id = ?
       AND customer_id = ?
       AND status IN ('confirmado', 'pendente')
       AND (appointment_date > ? OR (appointment_date = ? AND appointment_time > ?))`,
    [appointmentId, customerId, now.date, now.date, `${now.time}:00`],
  )

  if (result.affectedRows > 0) return

  const [rows] = await getPool().execute<OwnedAppointmentRow[]>(
    `SELECT id, barber_id, status, appointment_date, appointment_time
     FROM appointments
     WHERE id = ? AND customer_id = ?
     LIMIT 1`,
    [appointmentId, customerId],
  )
  if (!rows[0]) throw new AppointmentError('Agendamento não encontrado.', 404)
  throw new AppointmentError('Este agendamento não pode mais ser cancelado.', 409)
}
