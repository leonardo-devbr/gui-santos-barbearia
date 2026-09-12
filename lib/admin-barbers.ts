import 'server-only'

import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { getPool, withTransaction } from '@/lib/db'
import type { AdminBarber } from '@/lib/types'

interface AdminBarberRow extends RowDataPacket {
  id: string
  name: string
  specialty: string
  rating: number
  review_count: number
  bio: string
  photo_url: string
  is_active: number | boolean
}

interface IdRow extends RowDataPacket {
  id: string
}

export class AdminBarberError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function requireAdminAccess() {
  const admin = await getAuthenticatedAdmin()
  if (!admin) throw new AdminBarberError('Acesso administrativo não autorizado.', 401)
}

function mapBarber(row: AdminBarberRow): AdminBarber {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    rating: row.rating,
    reviewCount: row.review_count,
    bio: row.bio,
    photoUrl: row.photo_url,
    isActive: Boolean(row.is_active),
  }
}

function validateBarber(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const specialty =
    typeof body.specialty === 'string' ? body.specialty.trim().replace(/\s+/g, ' ') : ''
  const bio = typeof body.bio === 'string' ? body.bio.trim().replace(/\s+/g, ' ') : ''
  const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl.trim() : ''
  const rating = Number(body.rating)
  const reviewCount = Number(body.reviewCount)
  const isActive = body.isActive === undefined ? true : body.isActive === true

  if (name.length < 2 || name.length > 100) {
    throw new AdminBarberError('O nome deve ter entre 2 e 100 caracteres.', 422)
  }
  if (specialty.length < 3 || specialty.length > 160) {
    throw new AdminBarberError('A especialidade deve ter entre 3 e 160 caracteres.', 422)
  }
  if (bio.length < 3 || bio.length > 500) {
    throw new AdminBarberError('A apresentação deve ter entre 3 e 500 caracteres.', 422)
  }
  if (!photoUrl.startsWith('/') || photoUrl.length > 512 || photoUrl.includes('..')) {
    throw new AdminBarberError('Use o caminho local de uma imagem, como /images/foto.jpg.', 422)
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw new AdminBarberError('A avaliação deve estar entre 0 e 5.', 422)
  }
  if (!Number.isInteger(reviewCount) || reviewCount < 0 || reviewCount > 1_000_000) {
    throw new AdminBarberError('Informe uma quantidade válida de avaliações.', 422)
  }

  return {
    name,
    specialty,
    rating: Math.round(rating * 10) / 10,
    reviewCount,
    bio,
    photoUrl,
    isActive,
  }
}

export async function getAdminBarbers() {
  await requireAdminAccess()

  const [rows] = await getPool().execute<AdminBarberRow[]>(
    `SELECT id, name, specialty, rating, review_count, bio, photo_url, is_active
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
    if (duplicates[0]) throw new AdminBarberError('Já existe um barbeiro com este nome.', 409)

    const id = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO barbers
        (id, name, specialty, rating, review_count, bio, photo_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.specialty,
        input.rating,
        input.reviewCount,
        input.bio,
        input.photoUrl,
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
    const [barbers] = await connection.execute<IdRow[]>(
      'SELECT id FROM barbers WHERE id = ? LIMIT 1 FOR UPDATE',
      [id],
    )
    if (!barbers[0]) throw new AdminBarberError('Barbeiro não encontrado.', 404)

    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM barbers WHERE name = ? AND id <> ? LIMIT 1 FOR UPDATE',
      [input.name, id],
    )
    if (duplicates[0]) throw new AdminBarberError('Já existe um barbeiro com este nome.', 409)

    await connection.execute<ResultSetHeader>(
      `UPDATE barbers
       SET name = ?, specialty = ?, rating = ?, review_count = ?, bio = ?, photo_url = ?, is_active = ?
       WHERE id = ?`,
      [
        input.name,
        input.specialty,
        input.rating,
        input.reviewCount,
        input.bio,
        input.photoUrl,
        input.isActive,
        id,
      ],
    )

    return { id, ...input } satisfies AdminBarber
  })
}
