import 'server-only'

import { randomUUID } from 'node:crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedAdmin, getCurrentStaffSessionTokenHash } from '@/lib/admin-auth'
import { hashPassword, verifyPassword } from '@/lib/auth'
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

interface PasswordRow extends RowDataPacket {
  password_hash: string
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

async function requireCurrentAdminPassword(
  connection: PoolConnection,
  adminId: string,
  sessionTokenHash: string,
  value: unknown,
) {
  const password = typeof value === 'string' ? value : ''
  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    throw new AdminUserError('Informe sua senha atual para confirmar esta operação.', 422)
  }

  const [rows] = await connection.execute<PasswordRow[]>(
    `SELECT staff_users.password_hash
     FROM staff_sessions
     INNER JOIN staff_users ON staff_users.id = staff_sessions.staff_user_id
     WHERE staff_sessions.token_hash = ?
       AND staff_sessions.staff_user_id = ?
       AND staff_sessions.expires_at > UTC_TIMESTAMP()
       AND staff_users.role = 'admin'
       AND staff_users.is_active = TRUE
     LIMIT 1
     FOR UPDATE`,
    [sessionTokenHash, adminId],
  )
  if (!rows[0]) throw new AdminUserError('Acesso administrativo não autorizado.', 401)
  if (!(await verifyPassword(password, rows[0].password_hash))) {
    throw new AdminUserError('A senha atual não confere.', 403)
  }
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
  const sessionTokenHash = await getCurrentStaffSessionTokenHash()
  if (!sessionTokenHash) throw new AdminUserError('Acesso administrativo não autorizado.', 401)
  const identity = validateIdentity(body)
  const password = validatePassword(body.password, true)!
  const passwordHash = await hashPassword(password)

  return withTransaction(async (connection) => {
    await requireCurrentAdminPassword(
      connection,
      admin.id,
      sessionTokenHash,
      body.currentPassword,
    )
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
  const sessionTokenHash = await getCurrentStaffSessionTokenHash()
  if (!sessionTokenHash) throw new AdminUserError('Acesso administrativo não autorizado.', 401)
  if (!id || id.length > 64) throw new AdminUserError('Administrador não encontrado.', 404)
  const identity = validateIdentity(body)
  const password = validatePassword(body.password, false)
  const isActive = body.isActive === true

  if (id === admin.id && !isActive) {
    throw new AdminUserError('Você não pode desativar a própria conta.', 409)
  }

  const passwordHash = password ? await hashPassword(password) : null

  return withTransaction(async (connection) => {
    await requireCurrentAdminPassword(
      connection,
      admin.id,
      sessionTokenHash,
      body.currentPassword,
    )
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
