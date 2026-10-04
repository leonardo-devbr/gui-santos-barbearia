import 'server-only'

import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { NextResponse } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

interface RateLimitRow extends RowDataPacket {
  hit_count: number
  retry_after: number
}

const trustedIpHeaders = new Set(['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'])
const CLEANUP_BATCH_SIZE = 500

export interface RateLimitOptions {
  action: string
  identifier: string
  limit: number
  windowSeconds: number
}

function getBucketKey(action: string, identifier: string) {
  return createHash('sha256').update(`${action}\0${identifier}`).digest('hex')
}

export function getClientIdentifier(request: Request) {
  const configuredHeader = process.env.TRUSTED_PROXY_IP_HEADER?.trim().toLowerCase()
  if (!configuredHeader) return 'unknown'
  if (!trustedIpHeaders.has(configuredHeader)) {
    throw new Error(
      'TRUSTED_PROXY_IP_HEADER deve ser cf-connecting-ip, x-real-ip ou x-forwarded-for.',
    )
  }

  const rawAddress = request.headers.get(configuredHeader)
  const address =
    configuredHeader === 'x-forwarded-for'
      ? rawAddress?.split(',', 1)[0].trim()
      : rawAddress?.trim()

  return address && isIP(address) ? address : 'unknown'
}

async function consumeRateLimit({
  action,
  identifier,
  limit,
  windowSeconds,
}: RateLimitOptions) {
  const pool = getPool()
  const bucketKey = getBucketKey(action, identifier)

  await pool.execute<ResultSetHeader>(
    `INSERT INTO security_rate_limits
      (bucket_key, action, hit_count, window_started_at, expires_at)
     VALUES (?, ?, 1, UTC_TIMESTAMP(), TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP()))
     ON DUPLICATE KEY UPDATE
       hit_count = IF(
         expires_at <= UTC_TIMESTAMP(),
         1,
         LEAST(hit_count + 1, 65535)
       ),
       window_started_at = IF(
         expires_at <= UTC_TIMESTAMP(),
         UTC_TIMESTAMP(),
         window_started_at
       ),
       expires_at = IF(
         expires_at <= UTC_TIMESTAMP(),
         TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP()),
         expires_at
       )`,
    [bucketKey, action, windowSeconds, windowSeconds],
  )

  const [rows] = await pool.execute<RateLimitRow[]>(
    `SELECT
      hit_count,
      GREATEST(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at), 1) AS retry_after
     FROM security_rate_limits
     WHERE bucket_key = ?
     LIMIT 1`,
    [bucketKey],
  )
  const row = rows[0]

  return {
    allowed: Boolean(row && row.hit_count <= limit),
    retryAfter: row?.retry_after ?? windowSeconds,
  }
}

async function purgeExpiredRateLimits() {
  await getPool().execute<ResultSetHeader>(
    `DELETE FROM security_rate_limits
     WHERE expires_at <= UTC_TIMESTAMP()
     ORDER BY expires_at
     LIMIT ${CLEANUP_BATCH_SIZE}`,
  )
}

export async function consumeRateLimits(limits: RateLimitOptions[]) {
  await purgeExpiredRateLimits()

  for (const limit of limits) {
    const result = await consumeRateLimit(limit)
    if (!result.allowed) return result
  }

  return { allowed: true, retryAfter: 0 }
}

export async function resetRateLimit(action: string, identifier: string) {
  await getPool().execute<ResultSetHeader>(
    'DELETE FROM security_rate_limits WHERE bucket_key = ?',
    [getBucketKey(action, identifier)],
  )
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(Math.max(1, Math.ceil(retryAfter))),
      },
    },
  )
}
