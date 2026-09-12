import 'server-only'

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'
import type { CustomerProfile } from '@/lib/types'

const scrypt = promisify(scryptCallback)
const SESSION_COOKIE_NAME = 'gui_santos_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const PASSWORD_KEY_LENGTH = 64

interface CustomerRow extends RowDataPacket {
  id: string
  name: string
  phone: string
  email: string
  birth_date: string | null
  photo_url: string
  preferred_cut: string
  beard_style: string
  notes: string
  loyalty_points: number
}

function mapCustomer(row: CustomerRow): CustomerProfile {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    birthDate: row.birth_date ?? '',
    photoUrl: row.photo_url,
    preferredCut: row.preferred_cut,
    beardStyle: row.beard_style,
    notes: row.notes,
    loyaltyPoints: row.loyalty_points,
  }
}

export function createToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, encodedKey] = storedHash.split('$')

  if (algorithm !== 'scrypt' || !salt || !encodedKey) return false

  try {
    const expectedKey = Buffer.from(encodedKey, 'hex')
    const derivedKey = (await scrypt(password, salt, expectedKey.length)) as Buffer
    return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey)
  } catch {
    return false
  }
}

export async function createSession(customerId: string) {
  const token = createToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
  const pool = getPool()

  await pool.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()')
  await pool.execute(
    'INSERT INTO sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)',
    [tokenHash, customerId, expiresAt],
  )

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await getPool().execute<ResultSetHeader>('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)])
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getAuthenticatedCustomer() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const [rows] = await getPool().execute<CustomerRow[]>(
    `SELECT
      customers.id,
      customers.name,
      customers.phone,
      customers.email,
      customers.birth_date,
      customers.photo_url,
      customers.preferred_cut,
      customers.beard_style,
      customers.notes,
      customers.loyalty_points
    FROM sessions
    INNER JOIN customers ON customers.id = sessions.customer_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > UTC_TIMESTAMP()
    LIMIT 1`,
    [hashToken(token)],
  )

  return rows[0] ? mapCustomer(rows[0]) : null
}
