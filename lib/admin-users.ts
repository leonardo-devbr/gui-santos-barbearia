import 'server-only'

import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { hashPassword } from '@/lib/auth'
import { getPool, withTransaction } from '@/lib/db'
import type { AdminUser } from '@/lib/types'
import { isValidEmail, MAX_PASSWORD_LENGTH, normalizeEmail } from '@/lib/validation'

interface AdminUserRow extends RowDataPacket {
  id: string
  name: string
  email: string
  is_active: number | boolean
}

interface IdRow extends RowDataPacket {
  id: string
}

export class AdminUserError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function requireAdminAccess() {
  const admin = await getAuthenticatedAdmin()
  if (!admin) throw new AdminUserError('Acesso administrativo não autorizado.', 401)
  return admin
}

function mapAdminUser(row: AdminUserRow, currentAdminId: string): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isActive: Boolean(row.is_active),
    isCurrent: row.id === currentAdminId,
  }
}

function validateIdentity(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''

  if (name.length < 3 || name.length > 80) {
    throw new AdminUserError('O nome deve ter entre 3 e 80 caracteres.', 422)
  }
  if (!isValidEmail(email) || email.length > 254) {
    throw new AdminUserError('Informe um e-mail válido.', 422)
  }
  return { name, email }
}

function validatePassword(value: unknown, required: boolean) {
  const password = typeof value === 'string' ? value : ''
  if (!password && !required) return null
  if (
    password.length < 12 ||
    password.length > MAX_PASSWORD_LENGTH ||
    !/[A-Za-zÀ-ÿ]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new AdminUserError(
      'A senha deve ter entre 12 e 128 caracteres, incluindo uma letra e um número.',
      422,
    )
  }
  return password
}

export async function getAdminUsers() {
  const admin = await requireAdminAccess()
  const [rows] = await getPool().execute<AdminUserRow[]>(
    `SELECT id, name, email, is_active
     FROM staff_users
     WHERE role = 'admin'
     ORDER BY is_active DESC, name ASC`,
  )
  return rows.map((row) => mapAdminUser(row, admin.id))
}

export async function createAdminUser(body: Record<string, unknown>) {
  const admin = await requireAdminAccess()
  const identity = validateIdentity(body)
  const password = validatePassword(body.password, true)!
  const passwordHash = await hashPassword(password)

  return withTransaction(async (connection) => {
    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM staff_users WHERE email = ? LIMIT 1 FOR UPDATE',
      [identity.email],
    )
    if (duplicates[0]) throw new AdminUserError('Já existe uma conta com este e-mail.', 409)

    const id = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO staff_users (id, name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 'admin', TRUE)`,
      [id, identity.name, identity.email, passwordHash],
    )

    return {
      id,
      ...identity,
      isActive: true,
      isCurrent: id === admin.id,
    } satisfies AdminUser
  })
}

export async function updateAdminUser(id: string, body: Record<string, unknown>) {
  const admin = await requireAdminAccess()
  if (!id || id.length > 64) throw new AdminUserError('Administrador não encontrado.', 404)
  const identity = validateIdentity(body)
  const password = validatePassword(body.password, false)
  const isActive = body.isActive === true

  if (id === admin.id && !isActive) {
    throw new AdminUserError('Você não pode desativar a própria conta.', 409)
  }

  const passwordHash = password ? await hashPassword(password) : null

  return withTransaction(async (connection) => {
    const [users] = await connection.execute<IdRow[]>(
      `SELECT id
       FROM staff_users
       WHERE id = ? AND role = 'admin'
       LIMIT 1
       FOR UPDATE`,
      [id],
    )
    if (!users[0]) throw new AdminUserError('Administrador não encontrado.', 404)

    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM staff_users WHERE email = ? AND id <> ? LIMIT 1 FOR UPDATE',
      [identity.email, id],
    )
    if (duplicates[0]) throw new AdminUserError('Já existe uma conta com este e-mail.', 409)

    if (passwordHash) {
      await connection.execute<ResultSetHeader>(
        `UPDATE staff_users
         SET name = ?, email = ?, password_hash = ?, is_active = ?
         WHERE id = ?`,
        [identity.name, identity.email, passwordHash, isActive, id],
      )
    } else {
      await connection.execute<ResultSetHeader>(
        `UPDATE staff_users
         SET name = ?, email = ?, is_active = ?
         WHERE id = ?`,
        [identity.name, identity.email, isActive, id],
      )
    }

    const invalidatesCurrentSession = Boolean(passwordHash && id === admin.id)
    if (!isActive || passwordHash) {
      await connection.execute<ResultSetHeader>('DELETE FROM staff_sessions WHERE staff_user_id = ?', [id])
    }

    return {
      user: {
        id,
        ...identity,
        isActive,
        isCurrent: id === admin.id,
      } satisfies AdminUser,
      invalidatesCurrentSession,
    }
  })
}
