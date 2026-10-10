import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { withTransaction } from '@/lib/db'
import { parseWhatsAppNotificationCallbackData } from '@/lib/whatsapp-correlation'

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
  notificationId: string | null
  notificationAttempt: number | null
  status: WhatsAppWebhookStatus
  providerStatusAt: Date
  lastError: string | null
}

interface StoredWhatsAppWebhookStatusEvent {
  event_key: string
  provider_message_id: string
  notification_id: string | null
  notification_attempt: number | null
  status: WhatsAppWebhookStatus
  provider_status_at: string | Date
  last_error: string | null
}

type StoredWhatsAppWebhookStatusEventRow = StoredWhatsAppWebhookStatusEvent & RowDataPacket

interface WhatsAppNotificationMatchRow extends RowDataPacket {
  id: string
  attempts: number
  provider_message_id: string | null
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
  UPDATE whatsapp_notifications AS notifications
  INNER JOIN whatsapp_webhook_status_events AS status_events
    ON status_events.event_key = ? AND status_events.applied_at IS NULL
  SET notifications.status = ?, notifications.provider_status_at = ?,
    notifications.last_error = ?,
    notifications.provider_message_id = COALESCE(notifications.provider_message_id, ?),
    notifications.locked_at = NULL
  WHERE notifications.id = ?
    AND (
      notifications.provider_status_at IS NULL
      OR ? > CASE notifications.status
        WHEN 'accepted' THEN 0
        WHEN 'sent' THEN 1
        WHEN 'failed' THEN 2
        WHEN 'delivered' THEN 3
        WHEN 'read' THEN 4
        ELSE -1
      END
      OR (
        ? = CASE notifications.status
          WHEN 'accepted' THEN 0
          WHEN 'sent' THEN 1
          WHEN 'failed' THEN 2
          WHEN 'delivered' THEN 3
          WHEN 'read' THEN 4
          ELSE -1
        END
        AND notifications.provider_status_at <= ?
      )
    )
`

const selectPendingStatusEventsSql = `
  SELECT status_events.event_key, status_events.provider_message_id,
    status_events.notification_id, status_events.notification_attempt,
    status_events.status, status_events.provider_status_at, status_events.last_error
  FROM whatsapp_webhook_status_events AS status_events
  WHERE status_events.applied_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM whatsapp_notifications AS notifications
      WHERE notifications.provider_message_id = status_events.provider_message_id
        OR (
          status_events.notification_id IS NOT NULL
          AND status_events.notification_attempt IS NOT NULL
          AND notifications.id = status_events.notification_id
          AND notifications.attempts >= status_events.notification_attempt
        )
    )
  ORDER BY status_events.provider_status_at ASC, status_events.event_key ASC
  LIMIT 100
  FOR UPDATE
`

const selectPendingStatusEventsForMessageSql = `
  SELECT status_events.event_key, status_events.provider_message_id,
    status_events.notification_id, status_events.notification_attempt,
    status_events.status, status_events.provider_status_at, status_events.last_error
  FROM whatsapp_webhook_status_events AS status_events
  WHERE status_events.applied_at IS NULL
    AND status_events.provider_message_id = ?
    AND EXISTS (
      SELECT 1
      FROM whatsapp_notifications AS notifications
      WHERE notifications.provider_message_id = status_events.provider_message_id
        OR (
          status_events.notification_id IS NOT NULL
          AND status_events.notification_attempt IS NOT NULL
          AND notifications.id = status_events.notification_id
          AND notifications.attempts >= status_events.notification_attempt
        )
    )
  ORDER BY status_events.provider_status_at ASC, status_events.event_key ASC
  LIMIT 100
  FOR UPDATE
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
  const correlation = parseWhatsAppNotificationCallbackData(value.biz_opaque_callback_data)

  return {
    providerMessageId: value.id,
    notificationId: correlation?.notificationId ?? null,
    notificationAttempt: correlation?.attempt ?? null,
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

function createStatusEventKey(event: WhatsAppWebhookStatusEvent) {
  return createHash('sha256')
    .update(event.providerMessageId, 'utf8')
    .update('\u001f')
    .update(event.status, 'utf8')
    .update('\u001f')
    .update(event.providerStatusAt.toISOString(), 'utf8')
    .digest('hex')
}

async function applyStoredStatusEvent(
  connection: PoolConnection,
  event: StoredWhatsAppWebhookStatusEvent,
) {
  let [notifications] = await connection.execute<WhatsAppNotificationMatchRow[]>(
    `SELECT id, attempts, provider_message_id
     FROM whatsapp_notifications
     WHERE provider_message_id = ?
     LIMIT 1
     FOR UPDATE`,
    [event.provider_message_id],
  )
  if (!notifications[0] && event.notification_id && event.notification_attempt) {
    const [correlatedNotifications] = await connection.execute<WhatsAppNotificationMatchRow[]>(
      `SELECT id, attempts, provider_message_id
       FROM whatsapp_notifications
       WHERE id = ? AND attempts >= ?
       LIMIT 1
       FOR UPDATE`,
      [event.notification_id, event.notification_attempt],
    )
    notifications = correlatedNotifications
  }
  const notification = notifications[0]
  if (!notification) return 0

  const obsoleteFailedAttempt =
    event.status === 'failed' &&
    event.notification_attempt !== null &&
    event.notification_attempt < notification.attempts &&
    notification.provider_message_id !== event.provider_message_id

  if (obsoleteFailedAttempt) {
    await connection.execute<ResultSetHeader>(
      `UPDATE whatsapp_webhook_status_events
       SET applied_at = UTC_TIMESTAMP()
       WHERE event_key = ? AND applied_at IS NULL`,
      [event.event_key],
    )
    return 0
  }

  const [result] = await connection.execute<ResultSetHeader>(updateStatusSql, [
    event.event_key,
    event.status,
    event.provider_status_at,
    event.last_error,
    event.provider_message_id,
    notification.id,
    statusRanks[event.status],
    statusRanks[event.status],
    event.provider_status_at,
  ])

  await connection.execute<ResultSetHeader>(
    `UPDATE whatsapp_webhook_status_events AS status_events
     SET status_events.applied_at = UTC_TIMESTAMP()
     WHERE status_events.event_key = ?
       AND status_events.applied_at IS NULL`,
    [event.event_key],
  )

  return result.affectedRows
}

async function reconcileStoredStatusEvents(providerMessageId: string | null) {
  return withTransaction(async (connection) => {
    const [events] = await connection.execute<StoredWhatsAppWebhookStatusEventRow[]>(
      providerMessageId === null
        ? selectPendingStatusEventsSql
        : selectPendingStatusEventsForMessageSql,
      providerMessageId === null ? [] : [providerMessageId],
    )
    let updatedCount = 0

    for (const event of events) {
      updatedCount += await applyStoredStatusEvent(connection, event)
    }

    return updatedCount
  })
}

export async function applyPendingWhatsAppWebhookEventsForMessage(
  providerMessageId: string,
) {
  return reconcileStoredStatusEvents(providerMessageId)
}

export async function applyPendingWhatsAppWebhookStatusEvents() {
  return reconcileStoredStatusEvents(null)
}

export async function applyWhatsAppWebhookStatusEvents(
  events: readonly WhatsAppWebhookStatusEvent[],
) {
  if (events.length === 0) return 0

  return withTransaction(async (connection) => {
    let updatedCount = 0

    for (const event of events) {
      const eventKey = createStatusEventKey(event)
      await connection.execute<ResultSetHeader>(
        `INSERT IGNORE INTO whatsapp_webhook_status_events
          (event_key, provider_message_id, notification_id, notification_attempt,
           status, provider_status_at, last_error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          eventKey,
          event.providerMessageId,
          event.notificationId,
          event.notificationAttempt,
          event.status,
          event.providerStatusAt,
          event.lastError,
        ],
      )
      updatedCount += await applyStoredStatusEvent(connection, {
        event_key: eventKey,
        provider_message_id: event.providerMessageId,
        notification_id: event.notificationId,
        notification_attempt: event.notificationAttempt,
        status: event.status,
        provider_status_at: event.providerStatusAt,
        last_error: event.lastError,
      })
    }

    return updatedCount
  })
}
