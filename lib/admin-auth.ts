import 'server-only'

import { cookies } from 'next/headers'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { createToken, hashToken } from '@/lib/auth'
import { getPool } from '@/lib/db'

const LEGACY_STAFF_COOKIE_NAME = 'gui_santos_staff_session'
const STAFF_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-gui_santos_staff_session' : LEGACY_STAFF_COOKIE_NAME
const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12

export interface StaffUser {
  id: string
  name: string
  email: string
  role: 'admin' | 'barber'
  barberId: string | null
}

interface StaffRow extends RowDataPacket {
  id: string
  name: string
  email: string
  role: StaffUser['role']
  barber_id: string | null
}

export async function createStaffSession(staffUserId: string) {
  const token = createToken()
  const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_AGE_SECONDS * 1000)
  const pool = getPool()

  const cookieStore = await cookies()
  const previousToken = cookieStore.get(STAFF_COOKIE_NAME)?.value

  await pool.execute('DELETE FROM staff_sessions WHERE expires_at <= UTC_TIMESTAMP()')
  if (previousToken) {
    await pool.execute('DELETE FROM staff_sessions WHERE token_hash = ?', [hashToken(previousToken)])
  }
  await pool.execute(
    'INSERT INTO staff_sessions (token_hash, staff_user_id, expires_at) VALUES (?, ?, ?)',
    [hashToken(token), staffUserId, expiresAt],
  )
  await pool.execute(
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
    [staffUserId, hashToken(token), staffUserId, hashToken(token)],
  )

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
     WHERE staff_sessions.token_hash = ?
       AND staff_sessions.expires_at > UTC_TIMESTAMP()
       AND staff_users.is_active = TRUE
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
