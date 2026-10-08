import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { ResultSetHeader } from 'mysql2/promise'
import { getPool } from '@/lib/db'

export const WHATSAPP_WEBHOOK_MAX_BODY_BYTES = 256 * 1024

const MAX_ENTRIES = 100
const MAX_CHANGES_PER_ENTRY = 100
const MAX_STATUSES_PER_CHANGE = 100
const MAX_TOTAL_CHANGES = 100
const MAX_STATUS_EVENTS = 100
const MAX_EXTERNAL_ERROR_LENGTH = 300
const MAX_LAST_ERROR_LENGTH = 500
const MAX_UNIX_TIMESTAMP = 253_402_300_799

export type WhatsAppWebhookStatus = 'sent' | 'delivered' | 'read' | 'failed'

export interface WhatsAppWebhookStatusEvent {
  providerMessageId: string
  status: WhatsAppWebhookStatus
  providerStatusAt: Date
  lastError: string | null
}

export class WhatsAppWebhookConfigurationError extends Error {}
export class WhatsAppWebhookPayloadTooLargeError extends Error {}
export class WhatsAppWebhookPayloadError extends Error {}

const statusRanks: Record<'accepted' | WhatsAppWebhookStatus, number> = {
  accepted: 0,
  sent: 1,
  failed: 2,
  delivered: 3,
  read: 4,
}

const updateStatusSql = `
  UPDATE whatsapp_notifications
  SET status = ?, provider_status_at = ?, last_error = ?
  WHERE provider_message_id = ?
    AND (
      provider_status_at IS NULL
      OR provider_status_at < ?
      OR (
        provider_status_at = ?
        AND ? >= CASE status
          WHEN 'accepted' THEN 0
          WHEN 'sent' THEN 1
          WHEN 'failed' THEN 2
          WHEN 'delivered' THEN 3
          WHEN 'read' THEN 4
          ELSE -1
        END
      )
    )
`

function readRequiredSecret(name: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN' | 'WHATSAPP_APP_SECRET') {
  const value = process.env[name]?.trim()
  if (!value || Array.from(value).length < 32) {
    throw new WhatsAppWebhookConfigurationError(
      `${name} deve ser configurado com pelo menos 32 caracteres.`,
    )
  }
  return value
}

export function getWhatsAppWebhookVerifyToken() {
  return readRequiredSecret('WHATSAPP_WEBHOOK_VERIFY_TOKEN')
}

export function getWhatsAppAppSecret() {
  return readRequiredSecret('WHATSAPP_APP_SECRET')
}

export function verifyWhatsAppWebhookToken(receivedToken: string, expectedToken: string) {
  if (Buffer.byteLength(receivedToken, 'utf8') > 1_024) return false

  const receivedDigest = createHash('sha256').update(receivedToken, 'utf8').digest()
  const expectedDigest = createHash('sha256').update(expectedToken, 'utf8').digest()
  return timingSafeEqual(receivedDigest, expectedDigest)
}

export function verifyWhatsAppWebhookSignature(
  rawBody: Uint8Array,
  signatureHeader: string | null,
  appSecret: string,
) {
  if (!signatureHeader || !/^sha256=[a-f\d]{64}$/i.test(signatureHeader)) return false

  const receivedDigest = Buffer.from(signatureHeader.slice(7), 'hex')
  const expectedDigest = createHmac('sha256', appSecret).update(rawBody).digest()
  return timingSafeEqual(receivedDigest, expectedDigest)
}

function readDeclaredBodyLength(request: Request) {
  const value = request.headers.get('content-length')
  if (!value || !/^\d+$/.test(value)) return undefined
  const length = Number(value)
  return Number.isSafeInteger(length) ? length : undefined
}

export async function readWhatsAppWebhookRawBody(request: Request) {
  const declaredLength = readDeclaredBodyLength(request)
  if (declaredLength !== undefined && declaredLength > WHATSAPP_WEBHOOK_MAX_BODY_BYTES) {
    throw new WhatsAppWebhookPayloadTooLargeError('O corpo do webhook excede o limite permitido.')
  }

  if (!request.body) return Buffer.alloc(0)

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalLength += value.byteLength
      if (totalLength > WHATSAPP_WEBHOOK_MAX_BODY_BYTES) {
        await reader.cancel()
        throw new WhatsAppWebhookPayloadTooLargeError(
          'O corpo do webhook excede o limite permitido.',
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const rawBody = Buffer.allocUnsafe(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    rawBody.set(chunk, offset)
    offset += chunk.byteLength
  }
  return rawBody
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readLimitedArray(value: unknown, maximum: number, field: string) {
  if (!Array.isArray(value)) return []
  if (value.length > maximum) {
    throw new WhatsAppWebhookPayloadError(`O campo ${field} excede o limite permitido.`)
  }
  return value
}

function parseUnixTimestamp(value: unknown) {
  let seconds: number
  if (typeof value === 'string' && /^(?:0|[1-9]\d{0,11})$/.test(value)) {
    seconds = Number(value)
  } else if (typeof value === 'number' && Number.isSafeInteger(value)) {
    seconds = value
  } else {
    return undefined
  }

  if (seconds < 0 || seconds > MAX_UNIX_TIMESTAMP) return undefined
  const date = new Date(seconds * 1_000)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function sanitizeExternalErrorText(value: unknown) {
  if (typeof value !== 'string') return undefined

  const sanitized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(
      /\b(authorization|bearer|access[_ -]?token|app[_ -]?secret|api[_ -]?key)\b\s*[:=]?\s*\S+/gi,
      '$1 [redigido]',
    )
    .replace(/\b[A-Za-z\d_=-]{32,}\b/g, '[redigido]')
    .replace(/\+?\d(?:[\s().-]*\d){9,}/g, '[dado redigido]')
    .replace(/\s+/g, ' ')
    .trim()

  if (!sanitized) return undefined
  return sanitized.slice(0, MAX_EXTERNAL_ERROR_LENGTH)
}

function getSanitizedLastError(status: Record<string, unknown>) {
  const errors = Array.isArray(status.errors) ? status.errors : []
  const firstError = isRecord(errors[0]) ? errors[0] : undefined
  const providerCode =
    firstError && typeof firstError.code === 'number' && Number.isSafeInteger(firstError.code)
      ? firstError.code
      : undefined

  const errorData = firstError && isRecord(firstError.error_data) ? firstError.error_data : undefined
  const detail = sanitizeExternalErrorText(
    firstError?.title ?? firstError?.message ?? errorData?.details,
  )
  const codeLabel = providerCode === undefined ? '' : ` (código ${providerCode})`
  const detailLabel = detail ? `: ${detail}` : ''

  return `Falha informada pelo WhatsApp${codeLabel}${detailLabel}.`.slice(
    0,
    MAX_LAST_ERROR_LENGTH,
  )
}

function parseStatusEvent(value: unknown): WhatsAppWebhookStatusEvent | undefined {
  if (!isRecord(value)) return undefined
  if (
    value.status !== 'sent' &&
    value.status !== 'delivered' &&
    value.status !== 'read' &&
    value.status !== 'failed'
  ) {
    return undefined
  }
  if (
    typeof value.id !== 'string' ||
    !/^wamid\.[A-Za-z\d+/=_-]{1,500}$/.test(value.id)
  ) {
    return undefined
  }

  const providerStatusAt = parseUnixTimestamp(value.timestamp)
  if (!providerStatusAt) return undefined

  return {
    providerMessageId: value.id,
    status: value.status,
    providerStatusAt,
    lastError: value.status === 'failed' ? getSanitizedLastError(value) : null,
  }
}

export function extractWhatsAppWebhookStatusEvents(
  payload: unknown,
): WhatsAppWebhookStatusEvent[] {
  if (!isRecord(payload) || payload.object !== 'whatsapp_business_account') return []

  const events: WhatsAppWebhookStatusEvent[] = []
  const entries = readLimitedArray(payload.entry, MAX_ENTRIES, 'entry')
  let inspectedChanges = 0
  let inspectedStatuses = 0

  for (const entry of entries) {
    if (!isRecord(entry)) continue
    const changes = readLimitedArray(entry.changes, MAX_CHANGES_PER_ENTRY, 'changes')

    for (const change of changes) {
      inspectedChanges += 1
      if (inspectedChanges > MAX_TOTAL_CHANGES) {
        throw new WhatsAppWebhookPayloadError(
          'O webhook contém mais alterações que o limite permitido.',
        )
      }
      if (!isRecord(change) || change.field !== 'messages' || !isRecord(change.value)) continue
      const statuses = readLimitedArray(
        change.value.statuses,
        MAX_STATUSES_PER_CHANGE,
        'statuses',
      )
      inspectedStatuses += statuses.length
      if (inspectedStatuses > MAX_STATUS_EVENTS) {
        throw new WhatsAppWebhookPayloadError(
          'O webhook contém mais atualizações de status que o limite permitido.',
        )
      }

      for (const status of statuses) {
        const event = parseStatusEvent(status)
        if (!event) continue
        events.push(event)
      }
    }
  }

  return events
}

export async function applyWhatsAppWebhookStatusEvents(
  events: readonly WhatsAppWebhookStatusEvent[],
) {
  if (events.length === 0) return 0

  const pool = getPool()
  let updatedCount = 0

  for (const event of events) {
    const [result] = await pool.execute<ResultSetHeader>(updateStatusSql, [
      event.status,
      event.providerStatusAt,
      event.lastError,
      event.providerMessageId,
      event.providerStatusAt,
      event.providerStatusAt,
      statusRanks[event.status],
    ])
    if (result.affectedRows > 0) updatedCount += 1
  }

  return updatedCount
}
