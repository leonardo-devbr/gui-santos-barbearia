import 'server-only'

import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import {
  findFutureAppointmentsForBarber,
  summarizeAppointmentConflicts,
} from '@/lib/admin-appointment-conflicts'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
import {
  type AdminBarberFormField,
  validateAdminBarberForm,
} from '@/lib/admin-barber-validation'
import { getBarberPhotoUrl } from '@/lib/barber-photo'
import { getPool, withTransaction } from '@/lib/db'
import type { AdminBarber } from '@/lib/types'

interface AdminBarberRow extends RowDataPacket {
  id: string
  name: string
  phone: string
  specialty: string
  rating: number
  review_count: number
  bio: string
  photo_url: string
  has_uploaded_photo: number | boolean
  photo_position_x: number
  photo_position_y: number
  photo_revision: number
  is_active: number | boolean
}

interface IdRow extends RowDataPacket {
  id: string
}

interface BarberStatusRow extends IdRow {
  is_active: number | boolean
}

export class AdminBarberError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: AdminBarberFormField,
  ) {
    super(message)
  }
}

async function requireAdminAccess() {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new AdminBarberError('Acesso administrativo não autorizado.', 401)
  if (staff.role !== 'admin') {
    throw new AdminBarberError('Você não tem permissão para gerenciar barbeiros.', 403)
  }
}

function mapBarber(row: AdminBarberRow): AdminBarber {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    specialty: row.specialty,
    rating: row.rating,
    reviewCount: row.review_count,
    bio: row.bio,
    photoUrl: getBarberPhotoUrl(
      row.id,
      row.photo_url,
      Boolean(row.has_uploaded_photo),
      row.photo_revision,
    ),
    photoPositionX: row.photo_position_x,
    photoPositionY: row.photo_position_y,
    isActive: Boolean(row.is_active),
  }
}

function validateBarber(body: Record<string, unknown>) {
  const validation = validateAdminBarberForm({
    name: typeof body.name === 'string' ? body.name : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    specialty: typeof body.specialty === 'string' ? body.specialty : '',
    bio: typeof body.bio === 'string' ? body.bio : '',
    rating: typeof body.rating === 'number' || typeof body.rating === 'string' ? body.rating : '',
    reviewCount:
      typeof body.reviewCount === 'number' || typeof body.reviewCount === 'string'
        ? body.reviewCount
        : '',
  })
  const firstError = Object.entries(validation.errors)[0] as
    | [AdminBarberFormField, string]
    | undefined
  if (firstError) throw new AdminBarberError(firstError[1], 422, firstError[0])

  const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl.trim() : ''
  const photoPositionX = Number(body.photoPositionX ?? 50)
  const photoPositionY = Number(body.photoPositionY ?? 50)
  const isActive = body.isActive === undefined ? true : body.isActive === true

  if (!photoUrl.startsWith('/') || photoUrl.length > 512 || photoUrl.includes('..')) {
    throw new AdminBarberError(
      'Não foi possível reconhecer a imagem atual do perfil.',
      422,
      'photo',
    )
  }
  if (!Number.isInteger(photoPositionX) || photoPositionX < 0 || photoPositionX > 100) {
    throw new AdminBarberError('A posição horizontal da foto é inválida.', 422, 'photo')
  }
  if (!Number.isInteger(photoPositionY) || photoPositionY < 0 || photoPositionY > 100) {
    throw new AdminBarberError('A posição vertical da foto é inválida.', 422, 'photo')
  }

  return {
    ...validation.data,
    photoUrl,
    photoPositionX,
    photoPositionY,
    isActive,
  }
}

export async function getAdminBarbers() {
  await requireAdminAccess()

  const [rows] = await getPool().execute<AdminBarberRow[]>(
    `SELECT id, name, phone, specialty, rating, review_count, bio, photo_url,
       photo_data IS NOT NULL AS has_uploaded_photo,
       photo_position_x, photo_position_y, photo_revision, is_active
     FROM barbers
     ORDER BY is_active DESC, name ASC`,
  )
  return rows.map(mapBarber)
}

export async function createAdminBarber(body: Record<string, unknown>) {
  await requireAdminAccess()
  const input = validateBarber(body)

  return withTransaction(async (connection) => {
    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM barbers WHERE name = ? LIMIT 1 FOR UPDATE',
      [input.name],
    )
    if (duplicates[0]) {
      throw new AdminBarberError('Já existe um barbeiro com este nome.', 409, 'name')
    }

    const id = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO barbers
        (id, name, phone, specialty, rating, review_count, bio, photo_url,
         photo_position_x, photo_position_y, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.phone,
        input.specialty,
        input.rating,
        input.reviewCount,
        input.bio,
        input.photoUrl,
        input.photoPositionX,
        input.photoPositionY,
        input.isActive,
      ],
    )

    return { id, ...input } satisfies AdminBarber
  })
}

export async function updateAdminBarber(id: string, body: Record<string, unknown>) {
  await requireAdminAccess()
  if (!id || id.length > 64) throw new AdminBarberError('Barbeiro não encontrado.', 404)
  const input = validateBarber(body)

  return withTransaction(async (connection) => {
    const [barbers] = await connection.execute<BarberStatusRow[]>(
      'SELECT id, is_active FROM barbers WHERE id = ? LIMIT 1 FOR UPDATE',
      [id],
    )
    const barber = barbers[0]
    if (!barber) throw new AdminBarberError('Barbeiro não encontrado.', 404)

    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM barbers WHERE name = ? AND id <> ? LIMIT 1 FOR UPDATE',
      [input.name, id],
    )
    if (duplicates[0]) {
      throw new AdminBarberError('Já existe um barbeiro com este nome.', 409, 'name')
    }

    const appointmentConflicts =
      Boolean(barber.is_active) && !input.isActive
        ? await findFutureAppointmentsForBarber(connection, id)
        : []
    if (appointmentConflicts.length > 0) {
      throw new AdminBarberError(
        `Este barbeiro possui agendamentos ativos: ${summarizeAppointmentConflicts(appointmentConflicts)}. Remarque ou cancele antes de desativá-lo.`,
        409,
      )
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE barbers
       SET name = ?, phone = ?, specialty = ?, rating = ?, review_count = ?, bio = ?, photo_url = ?,
           photo_position_x = ?, photo_position_y = ?, is_active = ?
       WHERE id = ?`,
      [
        input.name,
        input.phone,
        input.specialty,
        input.rating,
        input.reviewCount,
        input.bio,
        input.photoUrl,
        input.photoPositionX,
        input.photoPositionY,
        input.isActive,
        id,
      ],
    )

    if (!input.isActive) {
      await connection.execute<ResultSetHeader>(
        `DELETE staff_sessions
         FROM staff_sessions
         INNER JOIN staff_users ON staff_users.id = staff_sessions.staff_user_id
         WHERE staff_users.barber_id = ?`,
        [id],
      )
    }

    return { id, ...input } satisfies AdminBarber
  })
}
