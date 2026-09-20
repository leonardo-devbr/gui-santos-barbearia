import 'server-only'

import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getBusinessConfiguration } from '@/lib/business'
import { getPublicAppUrl, sendEmail } from '@/lib/email'
import { createEmailVerificationEmail } from '@/lib/email-templates'

export type EmailVerificationPurpose = 'registration' | 'email_change'

export const EMAIL_VERIFICATION_MAX_AGE_MS = 24 * 60 * 60 * 1000

interface CustomerIdRow extends RowDataPacket {
  id: string
}

export async function cleanupExpiredEmailVerifications(connection: PoolConnection) {
  const [staleRegistrations] = await connection.execute<CustomerIdRow[]>(
    `SELECT customers.id
     FROM customers
     INNER JOIN email_verification_tokens
       ON email_verification_tokens.customer_id = customers.id
      AND email_verification_tokens.purpose = 'registration'
     WHERE customers.email_verified_at IS NULL
       AND email_verification_tokens.expires_at <= UTC_TIMESTAMP()
     LIMIT 100
     FOR UPDATE`,
  )
  if (staleRegistrations.length > 0) {
    await connection.execute<ResultSetHeader>(
      `DELETE FROM customers
       WHERE id IN (${staleRegistrations.map(() => '?').join(', ')})`,
      staleRegistrations.map((customer) => customer.id),
    )
  }

  const [staleEmailChanges] = await connection.execute<CustomerIdRow[]>(
    `SELECT customers.id
     FROM customers
     LEFT JOIN email_verification_tokens
       ON email_verification_tokens.customer_id = customers.id
      AND email_verification_tokens.purpose = 'email_change'
      AND email_verification_tokens.expires_at > UTC_TIMESTAMP()
     WHERE customers.pending_email IS NOT NULL
       AND email_verification_tokens.token_hash IS NULL
     LIMIT 100
     FOR UPDATE`,
  )
  if (staleEmailChanges.length > 0) {
    await connection.execute<ResultSetHeader>(
      `UPDATE customers
       SET pending_email = NULL
       WHERE id IN (${staleEmailChanges.map(() => '?').join(', ')})`,
      staleEmailChanges.map((customer) => customer.id),
    )
  }

  await connection.execute<ResultSetHeader>(
    `DELETE FROM email_verification_tokens
     WHERE expires_at <= UTC_TIMESTAMP()
     LIMIT 500`,
  )
}

export function createEmailVerificationUrl(token: string, requestUrl: string) {
  return `${getPublicAppUrl(requestUrl)}/verificar-email?token=${encodeURIComponent(token)}`
}

export function canExposeDevelopmentVerificationUrl(requestUrl: string) {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.DEV_EXPOSE_EMAIL_VERIFICATION_URL !== 'true') return false

  try {
    const hostname = new URL(requestUrl).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export async function sendEmailVerification({
  customerName,
  email,
  verificationUrl,
  purpose,
}: {
  customerName: string
  email: string
  verificationUrl: string
  purpose: EmailVerificationPurpose
}) {
  const { settings } = await getBusinessConfiguration()
  const emailMessage = createEmailVerificationEmail({
    customerName,
    verificationUrl,
    businessName: settings.name,
    purpose,
  })
  return sendEmail({ to: email, ...emailMessage })
}
