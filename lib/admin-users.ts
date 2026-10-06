import 'server-only'

import { randomUUID } from 'node:crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedStaff, getCurrentStaffSessionTokenHash } from '@/lib/admin-auth'
import type { AdminUserFormField } from '@/lib/admin-form-validation'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { getPool, withTransaction } from '@/lib/db'
import type { StaffAccount, StaffRole } from '@/lib/types'
import {
  isValidBrazilianPhone,
  isValidEmail,
  MAX_PASSWORD_LENGTH,
  normalizeEmail,
  normalizePhone,
} from '@/lib/validation'

interface StaffAccountRow extends RowDataPacket {
  id: string
  name: string
  email: string
  role: StaffRole
  barber_id: string | null
  barber_name: string | null
  notification_phone: string
  whatsapp_opt_in: number | boolean
  is_active: number | boolean
}

interface StaffIdentityRow extends RowDataPacket {
  id: string
  role: StaffRole
  barber_id: string | null
}

interface BarberRow extends RowDataPacket {
  id: string
  name: string
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
    readonly field?: AdminUserFormField,
  ) {
    super(message)
  }
}

async function requireAdminAccess() {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new AdminUserError('Acesso administrativo não autorizado.', 401)
  if (staff.role !== 'admin') {
    throw new AdminUserError('Você não tem permissão para gerenciar acessos.', 403)
  }
  return staff
}

function mapStaffAccount(row: StaffAccountRow, currentAdminId: string): StaffAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    barberId: row.barber_id,
    barberName: row.barber_name,
    notificationPhone: row.notification_phone,
    whatsappOptIn: Boolean(row.whatsapp_opt_in),
    isActive: Boolean(row.is_active),
    isCurrent: row.id === currentAdminId,
  }
}

function validateIdentity(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''

  if (name.length < 3 || name.length > 80) {
    throw new AdminUserError('O nome deve ter entre 3 e 80 caracteres.', 422, 'name')
  }
  if (!isValidEmail(email) || email.length > 254) {
    throw new AdminUserError('Informe um e-mail válido.', 422, 'email')
  }
  return { name, email }
}

function validateAccess(body: Record<string, unknown>) {
  const role = body.role
  if (role !== 'admin' && role !== 'barber') {
    throw new AdminUserError('Selecione um tipo de acesso válido.', 422, 'role')
  }

  const rawBarberId = typeof body.barberId === 'string' ? body.barberId.trim() : ''
  if (role === 'barber' && (!rawBarberId || rawBarberId.length > 64)) {
    throw new AdminUserError('Vincule a conta a um barbeiro.', 422, 'barberId')
  }

  return {
    role,
    barberId: role === 'barber' ? rawBarberId : null,
  } satisfies { role: StaffRole; barberId: string | null }
}

function validateWhatsappPreference(body: Record<string, unknown>) {
  const rawPhone = typeof body.notificationPhone === 'string' ? body.notificationPhone : ''
  const notificationPhone = normalizePhone(rawPhone)
  const whatsappOptIn = body.whatsappOptIn === true

  if (typeof body.whatsappOptIn !== 'boolean') {
    throw new AdminUserError(
      'Informe uma preferência válida para os avisos no WhatsApp.',
      422,
      'whatsappOptIn',
    )
  }
  if (notificationPhone && !isValidBrazilianPhone(rawPhone)) {
    throw new AdminUserError(
      'Informe um telefone brasileiro válido ou deixe o campo em branco.',
      422,
      'notificationPhone',
    )
  }
  if (whatsappOptIn && !isValidBrazilianPhone(rawPhone)) {
    throw new AdminUserError(
      'Informe um telefone brasileiro válido para ativar os avisos.',
      422,
      'notificationPhone',
    )
  }

  return { notificationPhone, whatsappOptIn }
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
      'password',
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
    throw new AdminUserError(
      'Informe sua senha atual para confirmar esta operação.',
      422,
      'currentPassword',
    )
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
    throw new AdminUserError('A senha atual não confere.', 403, 'currentPassword')
  }
}

async function lockBarber(
  connection: PoolConnection,
  role: StaffRole,
  barberId: string | null,
) {
  if (role === 'admin') return null

  const [rows] = await connection.execute<BarberRow[]>(
    'SELECT id, name FROM barbers WHERE id = ? LIMIT 1 FOR UPDATE',
    [barberId],
  )
  if (!rows[0]) throw new AdminUserError('Barbeiro não encontrado.', 422, 'barberId')
  return rows[0]
}

async function ensureUniqueAccess(
  connection: PoolConnection,
  email: string,
  barberId: string | null,
  excludedId?: string,
) {
  const [emailRows] = await connection.execute<IdRow[]>(
    `SELECT id FROM staff_users WHERE email = ? ${excludedId ? 'AND id <> ?' : ''} LIMIT 1 FOR UPDATE`,
    excludedId ? [email, excludedId] : [email],
  )
  if (emailRows[0]) {
    throw new AdminUserError('Já existe uma conta com este e-mail.', 409, 'email')
  }

  if (!barberId) return
  const [barberRows] = await connection.execute<IdRow[]>(
    `SELECT id FROM staff_users WHERE barber_id = ? ${excludedId ? 'AND id <> ?' : ''} LIMIT 1 FOR UPDATE`,
    excludedId ? [barberId, excludedId] : [barberId],
  )
  if (barberRows[0]) {
    throw new AdminUserError('Este barbeiro já possui uma conta de acesso.', 409, 'barberId')
  }
}

export async function getStaffAccounts() {
  const admin = await requireAdminAccess()
  const [rows] = await getPool().execute<StaffAccountRow[]>(
    `SELECT
       staff_users.id,
       staff_users.name,
       staff_users.email,
       staff_users.role,
       staff_users.barber_id,
       barbers.name AS barber_name,
       staff_users.notification_phone,
       staff_users.whatsapp_opt_in,
       staff_users.is_active
     FROM staff_users
     LEFT JOIN barbers ON barbers.id = staff_users.barber_id
     ORDER BY staff_users.is_active DESC, staff_users.role ASC, staff_users.name ASC`,
  )
  return rows.map((row) => mapStaffAccount(row, admin.id))
}

export async function createStaffAccount(body: Record<string, unknown>) {
  const admin = await requireAdminAccess()
  const sessionTokenHash = await getCurrentStaffSessionTokenHash()
  if (!sessionTokenHash) throw new AdminUserError('Acesso administrativo não autorizado.', 401)
  const identity = validateIdentity(body)
  const access = validateAccess(body)
  const whatsapp = validateWhatsappPreference(body)
  const password = validatePassword(body.password, true)!
  const passwordHash = await hashPassword(password)

  return withTransaction(async (connection) => {
    await requireCurrentAdminPassword(connection, admin.id, sessionTokenHash, body.currentPassword)
    const barber = await lockBarber(connection, access.role, access.barberId)
    await ensureUniqueAccess(connection, identity.email, access.barberId)

    const id = randomUUID()
    await connection.execute<ResultSetHeader>(
      `INSERT INTO staff_users
        (id, name, email, password_hash, role, barber_id, notification_phone,
         whatsapp_opt_in, whatsapp_opted_in_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(?, UTC_TIMESTAMP(), NULL), TRUE)`,
      [
        id,
        identity.name,
        identity.email,
        passwordHash,
        access.role,
        access.barberId,
        whatsapp.notificationPhone,
        whatsapp.whatsappOptIn,
        whatsapp.whatsappOptIn,
      ],
    )

    return {
      id,
      ...identity,
      ...access,
      ...whatsapp,
      barberName: barber?.name ?? null,
      isActive: true,
      isCurrent: false,
    } satisfies StaffAccount
  })
}

export async function updateStaffAccount(id: string, body: Record<string, unknown>) {
  const admin = await requireAdminAccess()
  const sessionTokenHash = await getCurrentStaffSessionTokenHash()
  if (!sessionTokenHash) throw new AdminUserError('Acesso administrativo não autorizado.', 401)
  if (!id || id.length > 64) throw new AdminUserError('Conta de acesso não encontrada.', 404)
  const identity = validateIdentity(body)
  const access = validateAccess(body)
  const whatsapp = validateWhatsappPreference(body)
  const password = validatePassword(body.password, false)
  const isActive = body.isActive === true

  if (id === admin.id && (!isActive || access.role !== 'admin')) {
    throw new AdminUserError('Você não pode remover o próprio acesso administrativo.', 409)
  }

  const passwordHash = password ? await hashPassword(password) : null

  return withTransaction(async (connection) => {
    await requireCurrentAdminPassword(connection, admin.id, sessionTokenHash, body.currentPassword)
    const [rows] = await connection.execute<StaffIdentityRow[]>(
      `SELECT id, role, barber_id
       FROM staff_users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id],
    )
    const current = rows[0]
    if (!current) throw new AdminUserError('Conta de acesso não encontrada.', 404)

    const barber = await lockBarber(connection, access.role, access.barberId)
    await ensureUniqueAccess(connection, identity.email, access.barberId, id)

    if (passwordHash) {
      await connection.execute<ResultSetHeader>(
        `UPDATE staff_users
         SET name = ?, email = ?, password_hash = ?, role = ?, barber_id = ?,
             whatsapp_opted_in_at = CASE
               WHEN ? = TRUE AND (
                 whatsapp_opt_in = FALSE OR notification_phone <> ?
               ) THEN UTC_TIMESTAMP()
               ELSE whatsapp_opted_in_at
             END,
             whatsapp_opted_out_at = CASE
               WHEN ? = FALSE AND whatsapp_opt_in = TRUE THEN UTC_TIMESTAMP()
               ELSE whatsapp_opted_out_at
             END,
             whatsapp_opt_in = ?, notification_phone = ?, is_active = ?
         WHERE id = ?`,
        [
          identity.name,
          identity.email,
          passwordHash,
          access.role,
          access.barberId,
          whatsapp.whatsappOptIn,
          whatsapp.notificationPhone,
          whatsapp.whatsappOptIn,
          whatsapp.whatsappOptIn,
          whatsapp.notificationPhone,
          isActive,
          id,
        ],
      )
    } else {
      await connection.execute<ResultSetHeader>(
        `UPDATE staff_users
         SET name = ?, email = ?, role = ?, barber_id = ?,
             whatsapp_opted_in_at = CASE
               WHEN ? = TRUE AND (
                 whatsapp_opt_in = FALSE OR notification_phone <> ?
               ) THEN UTC_TIMESTAMP()
               ELSE whatsapp_opted_in_at
             END,
             whatsapp_opted_out_at = CASE
               WHEN ? = FALSE AND whatsapp_opt_in = TRUE THEN UTC_TIMESTAMP()
               ELSE whatsapp_opted_out_at
             END,
             whatsapp_opt_in = ?, notification_phone = ?, is_active = ?
         WHERE id = ?`,
        [
          identity.name,
          identity.email,
          access.role,
          access.barberId,
          whatsapp.whatsappOptIn,
          whatsapp.notificationPhone,
          whatsapp.whatsappOptIn,
          whatsapp.whatsappOptIn,
          whatsapp.notificationPhone,
          isActive,
          id,
        ],
      )
    }

    const accessChanged =
      current.role !== access.role || current.barber_id !== access.barberId
    if (!isActive || passwordHash || accessChanged) {
      await connection.execute<ResultSetHeader>(
        'DELETE FROM staff_sessions WHERE staff_user_id = ?',
        [id],
      )
    }

    return {
      user: {
        id,
        ...identity,
        ...access,
        ...whatsapp,
        barberName: barber?.name ?? null,
        isActive,
        isCurrent: id === admin.id,
      } satisfies StaffAccount,
      invalidatesCurrentSession: Boolean(passwordHash && id === admin.id),
    }
  })
}
