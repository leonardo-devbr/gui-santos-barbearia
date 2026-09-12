import 'server-only'

import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { getPool, withTransaction } from '@/lib/db'
import type { AdminService, Service } from '@/lib/types'

interface AdminServiceRow extends RowDataPacket {
  id: string
  name: string
  description: string
  duration_minutes: number
  price: number
  category: Service['category']
  is_active: number | boolean
}

interface IdRow extends RowDataPacket {
  id: string
}

const categories: Service['category'][] = ['cortes', 'barba', 'combos', 'acabamentos']

export class AdminServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function requireAdminAccess() {
  const admin = await getAuthenticatedAdmin()
  if (!admin) throw new AdminServiceError('Acesso administrativo não autorizado.', 401)
}

function mapService(row: AdminServiceRow): AdminService {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    price: row.price,
    category: row.category,
    isActive: Boolean(row.is_active),
  }
}

function validateService(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const description =
    typeof body.description === 'string' ? body.description.trim().replace(/\s+/g, ' ') : ''
  const durationMinutes = Number(body.durationMinutes)
  const price = Number(body.price)
  const category = typeof body.category === 'string' ? body.category : ''
  const isActive = body.isActive === undefined ? true : body.isActive === true

  if (name.length < 2 || name.length > 100) {
    throw new AdminServiceError('O nome deve ter entre 2 e 100 caracteres.', 422)
  }
  if (description.length < 3 || description.length > 255) {
    throw new AdminServiceError('A descrição deve ter entre 3 e 255 caracteres.', 422)
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) {
    throw new AdminServiceError('A duração deve ser de 5 a 240 minutos.', 422)
  }
  if (!Number.isFinite(price) || price <= 0 || price > 9999.99) {
    throw new AdminServiceError('Informe um preço válido de até R$ 9.999,99.', 422)
  }
  if (!categories.includes(category as Service['category'])) {
    throw new AdminServiceError('Selecione uma categoria válida.', 422)
  }

  return {
    name,
    description,
    durationMinutes,
    price: Math.round(price * 100) / 100,
    category: category as Service['category'],
    isActive,
  }
}

export async function getAdminServices() {
  await requireAdminAccess()

  const [rows] = await getPool().execute<AdminServiceRow[]>(
    `SELECT id, name, description, duration_minutes, price, category, is_active
     FROM services
     ORDER BY is_active DESC,
       FIELD(category, 'cortes', 'barba', 'combos', 'acabamentos'),
       name ASC`,
  )
  return rows.map(mapService)
}

export async function createAdminService(body: Record<string, unknown>) {
  await requireAdminAccess()
  const input = validateService(body)

  return withTransaction(async (connection) => {
    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM services WHERE name = ? LIMIT 1 FOR UPDATE',
      [input.name],
    )
    if (duplicates[0]) throw new AdminServiceError('Já existe um serviço com este nome.', 409)

    const id = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO services
        (id, name, description, duration_minutes, price, category, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name,
        input.description,
        input.durationMinutes,
        input.price,
        input.category,
        input.isActive,
      ],
    )

    return { id, ...input } satisfies AdminService
  })
}

export async function updateAdminService(id: string, body: Record<string, unknown>) {
  await requireAdminAccess()
  if (!id || id.length > 64) throw new AdminServiceError('Serviço não encontrado.', 404)
  const input = validateService(body)

  return withTransaction(async (connection) => {
    const [services] = await connection.execute<IdRow[]>(
      'SELECT id FROM services WHERE id = ? LIMIT 1 FOR UPDATE',
      [id],
    )
    if (!services[0]) throw new AdminServiceError('Serviço não encontrado.', 404)

    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM services WHERE name = ? AND id <> ? LIMIT 1 FOR UPDATE',
      [input.name, id],
    )
    if (duplicates[0]) throw new AdminServiceError('Já existe um serviço com este nome.', 409)

    await connection.execute<ResultSetHeader>(
      `UPDATE services
       SET name = ?, description = ?, duration_minutes = ?, price = ?, category = ?, is_active = ?
       WHERE id = ?`,
      [
        input.name,
        input.description,
        input.durationMinutes,
        input.price,
        input.category,
        input.isActive,
        id,
      ],
    )

    return { id, ...input } satisfies AdminService
  })
}
