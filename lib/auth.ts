import 'server-only'

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { cookies } from 'next/headers'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getPool, withTransaction } from '@/lib/db'
import type { CustomerProfile } from '@/lib/types'

const scrypt = promisify(scryptCallback)
const LEGACY_SESSION_COOKIE_NAME = 'gui_santos_session'
const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-gui_santos_session' : LEGACY_SESSION_COOKIE_NAME
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const PASSWORD_KEY_LENGTH = 64
const DUMMY_PASSWORD_HASH =
  'scrypt$6f9c8f460f4ef207d0f9247cd41b278a$0fc89881f74eb107e9ec634f863fe5e385e8ab4a9a7122b75eb0edd877acdeac17245f5ea57b8d7f9bc5b31e645d79f86ea4f1e599a6163f4e5953343b0a1be3'

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
}

interface LoginCredentialRow extends RowDataPacket {
  id: string
  password_hash: string
  email_verified_at: string | null
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
  }
}

export function createToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getCurrentCustomerSessionTokenHash() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  return token ? hashToken(token) : null
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

export async function authenticateCustomer(email: string, password: string) {
  const cookieStore = await cookies()
  const previousToken = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const token = createToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
  const result = await withTransaction<'invalid' | 'unverified' | 'authenticated'>(
    async (connection) => {
      const [rows] = await connection.execute<LoginCredentialRow[]>(
        `SELECT id, password_hash, email_verified_at
         FROM customers
         WHERE email = ?
         LIMIT 1
         FOR UPDATE`,
        [email],
      )
      const customer = rows[0]
      const passwordMatches = await verifyPassword(
        password,
        customer?.password_hash ?? DUMMY_PASSWORD_HASH,
      )

      if (!customer || !passwordMatches) return 'invalid'
      if (!customer.email_verified_at) return 'unverified'

      await connection.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()')
      if (previousToken) {
        await connection.execute('DELETE FROM sessions WHERE token_hash = ?', [
          hashToken(previousToken),
        ])
      }
      await connection.execute(
        'INSERT INTO sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)',
        [tokenHash, customer.id, expiresAt],
      )
      await connection.execute(
        `DELETE FROM sessions
         WHERE customer_id = ?
           AND token_hash <> ?
           AND token_hash NOT IN (
             SELECT token_hash FROM (
               SELECT token_hash
               FROM sessions
               WHERE customer_id = ? AND token_hash <> ?
               ORDER BY created_at DESC, token_hash DESC
               LIMIT 4
             ) AS recent_sessions
           )`,
        [customer.id, tokenHash, customer.id, tokenHash],
      )
      return 'authenticated'
    },
  )

  if (result !== 'authenticated') return result

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    priority: 'high',
  })
  if (SESSION_COOKIE_NAME !== LEGACY_SESSION_COOKIE_NAME) {
    cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)
  }
  return result
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await getPool().execute<ResultSetHeader>('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)])
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
  if (SESSION_COOKIE_NAME !== LEGACY_SESSION_COOKIE_NAME) {
    cookieStore.delete(LEGACY_SESSION_COOKIE_NAME)
  }
}

export async function revokeOtherCustomerSessions(customerId: string) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token) return

  await getPool().execute<ResultSetHeader>(
    'DELETE FROM sessions WHERE customer_id = ? AND token_hash <> ?',
    [customerId, hashToken(token)],
  )
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
      customers.notes
    FROM sessions
    INNER JOIN customers ON customers.id = sessions.customer_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > UTC_TIMESTAMP()
    LIMIT 1`,
    [hashToken(token)],
  )

  return rows[0] ? mapCustomer(rows[0]) : null
}
