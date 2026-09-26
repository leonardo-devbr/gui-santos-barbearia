import 'server-only'

import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import {
  findAppointmentConflictsForScheduleBlock,
  summarizeAppointmentConflicts,
} from '@/lib/admin-appointment-conflicts'
import { getAuthenticatedStaff, type StaffUser } from '@/lib/admin-auth'
import { getTodayInSaoPaulo, isValidIsoDate, isValidTime } from '@/lib/date'
import { getPool, withTransaction } from '@/lib/db'
import type { ScheduleBlock } from '@/lib/types'

interface ScheduleBlockRow extends RowDataPacket {
  id: string
  barber_id: string | null
  barber_name: string | null
  block_date: string
  start_time: string | null
  end_time: string | null
  reason: string
  created_by: string
}

interface BarberRow extends RowDataPacket {
  id: string
  name: string
}

interface IdRow extends RowDataPacket {
  id: string
}

export class AdminScheduleBlockError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function requireStaffAccess() {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new AdminScheduleBlockError('Acesso da equipe não autorizado.', 401)
  if (staff.role === 'barber' && !staff.barberId) {
    throw new AdminScheduleBlockError('Esta conta não está vinculada a um barbeiro.', 403)
  }
  return staff
}

function mapScheduleBlock(row: ScheduleBlockRow, staff: StaffUser): ScheduleBlock {
  return {
    id: row.id,
    barberId: row.barber_id,
    barberName: row.barber_name ?? 'Todos os barbeiros',
    date: row.block_date,
    startTime: row.start_time?.slice(0, 5) ?? null,
    endTime: row.end_time?.slice(0, 5) ?? null,
    reason: row.reason,
    canDelete:
      staff.role === 'admin' ||
      (row.barber_id === staff.barberId && row.created_by === staff.id),
  }
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function validateInput(body: Record<string, unknown>) {
  const rawBarberId = typeof body.barberId === 'string' ? body.barberId.trim() : ''
  const barberId = rawBarberId === 'all' ? null : rawBarberId
  const date = typeof body.date === 'string' ? body.date.trim() : ''
  const fullDay = body.fullDay === true
  const startTime = fullDay || typeof body.startTime !== 'string' ? null : body.startTime.trim()
  const endTime = fullDay || typeof body.endTime !== 'string' ? null : body.endTime.trim()
  const reason = typeof body.reason === 'string' ? body.reason.trim().replace(/\s+/g, ' ') : ''

  if (barberId !== null && (!barberId || barberId.length > 64)) {
    throw new AdminScheduleBlockError('Selecione um barbeiro válido.', 422)
  }
  if (!isValidIsoDate(date) || date < getTodayInSaoPaulo()) {
    throw new AdminScheduleBlockError('Escolha uma data atual ou futura.', 422)
  }
  if (!fullDay) {
    if (!startTime || !endTime || !isValidTime(startTime) || !isValidTime(endTime)) {
      throw new AdminScheduleBlockError('Informe o início e o fim do bloqueio.', 422)
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new AdminScheduleBlockError('O horário final deve ser posterior ao inicial.', 422)
    }
  }
  if (reason.length < 3 || reason.length > 160) {
    throw new AdminScheduleBlockError('O motivo deve ter entre 3 e 160 caracteres.', 422)
  }

  return { barberId, date, startTime, endTime, reason }
}

export async function getAdminScheduleBlocks() {
  const staff = await requireStaffAccess()
  const scopeClause =
    staff.role === 'barber' ? 'AND (schedule_blocks.barber_id = ? OR schedule_blocks.barber_id IS NULL)' : ''
  const parameters =
    staff.role === 'barber' ? [getTodayInSaoPaulo(), staff.barberId!] : [getTodayInSaoPaulo()]

  const [rows] = await getPool().execute<ScheduleBlockRow[]>(
    `SELECT
      schedule_blocks.id,
      schedule_blocks.barber_id,
      barbers.name AS barber_name,
      schedule_blocks.block_date,
      schedule_blocks.start_time,
      schedule_blocks.end_time,
      schedule_blocks.reason,
      schedule_blocks.created_by
    FROM schedule_blocks
    LEFT JOIN barbers ON barbers.id = schedule_blocks.barber_id
    WHERE schedule_blocks.block_date >= ?
      ${scopeClause}
    ORDER BY schedule_blocks.block_date ASC, schedule_blocks.start_time ASC, barber_name ASC`,
    parameters,
  )

  return rows.map((row) => mapScheduleBlock(row, staff))
}

export async function createAdminScheduleBlock(body: Record<string, unknown>) {
  const staff = await requireStaffAccess()
  const scopedBody =
    staff.role === 'barber' ? { ...body, barberId: staff.barberId } : body
  const input = validateInput(scopedBody)

  return withTransaction(async (connection) => {
    const [barbers] = await connection.execute<BarberRow[]>(
      input.barberId
        ? 'SELECT id, name FROM barbers WHERE id = ? AND is_active = TRUE LIMIT 1 FOR UPDATE'
        : 'SELECT id, name FROM barbers WHERE is_active = TRUE ORDER BY id FOR UPDATE',
      input.barberId ? [input.barberId] : [],
    )

    if (barbers.length === 0) {
      throw new AdminScheduleBlockError('Nenhum barbeiro disponível foi encontrado.', 422)
    }

    const overlapParameters: Array<string> = [input.date]
    const barberClause = input.barberId ? 'AND (barber_id = ? OR barber_id IS NULL)' : ''
    if (input.barberId) overlapParameters.push(input.barberId)

    let timeClause = ''
    if (input.startTime && input.endTime) {
      timeClause = `AND (
        (start_time IS NULL AND end_time IS NULL)
        OR (TIME_TO_SEC(start_time) < TIME_TO_SEC(?) AND TIME_TO_SEC(end_time) > TIME_TO_SEC(?))
      )`
      overlapParameters.push(`${input.endTime}:00`, `${input.startTime}:00`)
    }

    const [overlappingBlocks] = await connection.execute<IdRow[]>(
      `SELECT id
       FROM schedule_blocks
       WHERE block_date = ?
         ${barberClause}
         ${timeClause}
       LIMIT 1
       FOR UPDATE`,
      overlapParameters,
    )
    if (overlappingBlocks[0]) {
      throw new AdminScheduleBlockError('Já existe um bloqueio para este período.', 409)
    }

    const appointmentConflicts = await findAppointmentConflictsForScheduleBlock(connection, input)
    if (appointmentConflicts.length > 0) {
      throw new AdminScheduleBlockError(
        `Este bloqueio conflita com: ${summarizeAppointmentConflicts(appointmentConflicts)}. Remarque ou cancele antes de bloquear.`,
        409,
      )
    }

    const id = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO schedule_blocks
        (id, barber_id, block_date, start_time, end_time, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.barberId,
        input.date,
        input.startTime ? `${input.startTime}:00` : null,
        input.endTime ? `${input.endTime}:00` : null,
        input.reason,
        staff.id,
      ],
    )

    return {
      id,
      barberId: input.barberId,
      barberName: input.barberId ? barbers[0].name : 'Todos os barbeiros',
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason,
      canDelete: true,
    } satisfies ScheduleBlock
  })
}

export async function deleteAdminScheduleBlock(id: string) {
  const staff = await requireStaffAccess()
  if (!id || id.length > 64) throw new AdminScheduleBlockError('Bloqueio não encontrado.', 404)

  const scopeClause =
    staff.role === 'barber' ? 'AND barber_id = ? AND created_by = ?' : ''
  const parameters =
    staff.role === 'barber' ? [id, staff.barberId!, staff.id] : [id]
  const [result] = await getPool().execute<ResultSetHeader>(
    `DELETE FROM schedule_blocks WHERE id = ? ${scopeClause}`,
    parameters,
  )
  if (result.affectedRows === 0) {
    throw new AdminScheduleBlockError('Bloqueio não encontrado.', 404)
  }
}
