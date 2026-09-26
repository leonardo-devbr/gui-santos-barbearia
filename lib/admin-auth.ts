import 'server-only'

import { cookies } from 'next/headers'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { createToken, hashToken, verifyPassword } from '@/lib/auth'
import { getPool, withTransaction } from '@/lib/db'
import type { StaffRole } from '@/lib/types'

const LEGACY_STAFF_COOKIE_NAME = 'gui_santos_staff_session'
const STAFF_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-gui_santos_staff_session' : LEGACY_STAFF_COOKIE_NAME
const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12
const DUMMY_PASSWORD_HASH =
  'scrypt$6f9c8f460f4ef207d0f9247cd41b278a$0fc89881f74eb107e9ec634f863fe5e385e8ab4a9a7122b75eb0edd877acdeac17245f5ea57b8d7f9bc5b31e645d79f86ea4f1e599a6163f4e5953343b0a1be3'

export interface StaffUser {
  id: string
  name: string
  email: string
  role: StaffRole
  barberId: string | null
}

interface StaffRow extends RowDataPacket {
  id: string
  name: string
  email: string
  role: StaffUser['role']
  barber_id: string | null
}

interface StaffLoginRow extends RowDataPacket {
  id: string
  password_hash: string
  role: StaffUser['role']
  barber_id: string | null
  barber_is_active: number | boolean | null
  is_active: number | boolean
}

export async function getCurrentStaffSessionTokenHash() {
  const token = (await cookies()).get(STAFF_COOKIE_NAME)?.value
  return token ? hashToken(token) : null
}

export async function authenticateStaff(email: string, password: string) {
  const cookieStore = await cookies()
  const previousToken = cookieStore.get(STAFF_COOKIE_NAME)?.value
  const token = createToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_AGE_SECONDS * 1000)
  const authenticatedRole = await withTransaction<StaffRole | null>(async (connection) => {
    const [rows] = await connection.execute<StaffLoginRow[]>(
      `SELECT
         staff_users.id,
         staff_users.password_hash,
         staff_users.role,
         staff_users.barber_id,
         staff_users.is_active,
         barbers.is_active AS barber_is_active
       FROM staff_users
       LEFT JOIN barbers ON barbers.id = staff_users.barber_id
       WHERE staff_users.email = ?
       LIMIT 1
       FOR UPDATE`,
      [email],
    )
    const staff = rows[0]
    const passwordMatches = await verifyPassword(
      password,
      staff?.password_hash ?? DUMMY_PASSWORD_HASH,
    )

    const hasValidBarberAccess =
      staff?.role === 'barber' && Boolean(staff.barber_id) && Boolean(staff.barber_is_active)
    if (
      !staff ||
      !staff.is_active ||
      !passwordMatches ||
      (staff.role !== 'admin' && !hasValidBarberAccess)
    ) {
      return null
    }

    await connection.execute('DELETE FROM staff_sessions WHERE expires_at <= UTC_TIMESTAMP()')
    if (previousToken) {
      await connection.execute('DELETE FROM staff_sessions WHERE token_hash = ?', [
        hashToken(previousToken),
      ])
    }
    await connection.execute(
      'INSERT INTO staff_sessions (token_hash, staff_user_id, expires_at) VALUES (?, ?, ?)',
      [tokenHash, staff.id, expiresAt],
    )
    await connection.execute(
      `DELETE FROM staff_sessions
       WHERE staff_user_id = ?
         AND token_hash <> ?
         AND token_hash NOT IN (
           SELECT token_hash FROM (
             SELECT token_hash
             FROM staff_sessions
             WHERE staff_user_id = ? AND token_hash <> ?
             ORDER BY created_at DESC, token_hash DESC
             LIMIT 2
           ) AS recent_sessions
         )`,
      [staff.id, tokenHash, staff.id, tokenHash],
    )
    return staff.role
  })

  if (!authenticatedRole) return null

  cookieStore.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STAFF_SESSION_MAX_AGE_SECONDS,
    priority: 'high',
  })
  if (STAFF_COOKIE_NAME !== LEGACY_STAFF_COOKIE_NAME) {
    cookieStore.delete(LEGACY_STAFF_COOKIE_NAME)
  }
  return authenticatedRole
}

export async function destroyStaffSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value

  if (token) {
    await getPool().execute<ResultSetHeader>('DELETE FROM staff_sessions WHERE token_hash = ?', [
      hashToken(token),
    ])
  }

  cookieStore.delete(STAFF_COOKIE_NAME)
  if (STAFF_COOKIE_NAME !== LEGACY_STAFF_COOKIE_NAME) {
    cookieStore.delete(LEGACY_STAFF_COOKIE_NAME)
  }
}

export async function getAuthenticatedStaff(): Promise<StaffUser | null> {
  const token = (await cookies()).get(STAFF_COOKIE_NAME)?.value
  if (!token) return null

  const [rows] = await getPool().execute<StaffRow[]>(
    `SELECT staff_users.id, staff_users.name, staff_users.email, staff_users.role, staff_users.barber_id
     FROM staff_sessions
     INNER JOIN staff_users ON staff_users.id = staff_sessions.staff_user_id
     LEFT JOIN barbers ON barbers.id = staff_users.barber_id
     WHERE staff_sessions.token_hash = ?
       AND staff_sessions.expires_at > UTC_TIMESTAMP()
       AND staff_users.is_active = TRUE
       AND (
         staff_users.role = 'admin'
         OR (
           staff_users.role = 'barber'
           AND staff_users.barber_id IS NOT NULL
           AND barbers.is_active = TRUE
         )
       )
     LIMIT 1`,
    [hashToken(token)],
  )
  const staff = rows[0]

  return staff
    ? {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        barberId: staff.barber_id,
      }
    : null
}

export async function getAuthenticatedAdmin() {
  const staff = await getAuthenticatedStaff()
  return staff?.role === 'admin' ? staff : null
}
