import 'server-only'

import { cookies } from 'next/headers'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { createToken, hashToken } from '@/lib/auth'
import { getPool } from '@/lib/db'

const STAFF_COOKIE_NAME = 'gui_santos_staff_session'
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

  await pool.execute('DELETE FROM staff_sessions WHERE expires_at <= UTC_TIMESTAMP()')
  await pool.execute(
    'INSERT INTO staff_sessions (token_hash, staff_user_id, expires_at) VALUES (?, ?, ?)',
    [hashToken(token), staffUserId, expiresAt],
  )

  const cookieStore = await cookies()
  cookieStore.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STAFF_SESSION_MAX_AGE_SECONDS,
  })
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
