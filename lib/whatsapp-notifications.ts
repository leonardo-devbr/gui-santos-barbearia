import 'server-only'

import { randomUUID } from 'node:crypto'
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getPool, withTransaction } from '@/lib/db'
import { formatDateLong, formatPrice } from '@/lib/format'
import type {
  AppointmentWhatsAppDetails,
  AppointmentWhatsAppEvent,
  WhatsAppRecipientAudience,
} from '@/lib/whatsapp-templates'
import {
  sendAppointmentWhatsApp,
  WhatsAppDeliveryError,
} from '@/lib/whatsapp'

type AppointmentMutationEvent = Extract<
  AppointmentWhatsAppEvent,
  'appointment_created' | 'appointment_rescheduled' | 'appointment_cancelled'
>
type WhatsAppRecipientKind = 'customer' | 'staff'
type WhatsAppNotificationStatus =
  | 'pending'
  | 'processing'
  | 'previewed'
  | 'accepted'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'skipped'
  | 'superseded'

interface AppointmentQueueRow extends RowDataPacket {
  id: string
  customer_id: string
  barber_id: string
  notification_revision: number
  status: 'confirmado' | 'concluido' | 'cancelado'
  appointment_date: string
  appointment_time: string
  price: number
  customer_name: string
  customer_phone: string
  customer_whatsapp_opt_in: number | boolean
  service_name: string
  barber_name: string
  business_name: string
}

interface StaffRecipientRow extends RowDataPacket {
  id: string
  name: string
  notification_phone: string
  role: 'admin' | 'barber'
  barber_id: string | null
}

interface NotificationReferenceRow extends RowDataPacket {
  appointment_id: string | null
}

interface NotificationRow extends RowDataPacket {
  id: string
  appointment_id: string
  appointment_revision: number
  event: AppointmentWhatsAppEvent
  audience: WhatsAppRecipientAudience
  recipient_kind: WhatsAppRecipientKind
  recipient_id: string
  recipient_phone: string
  recipient_name: string
  details_snapshot: unknown
  status: WhatsAppNotificationStatus
  attempts: number
}

interface AppointmentValidationRow extends RowDataPacket {
  notification_revision: number
  status: 'confirmado' | 'concluido' | 'cancelado'
  barber_id: string
}

interface CustomerRecipientRow extends RowDataPacket {
  name: string
  phone: string
  whatsapp_opt_in: number | boolean
}

interface CurrentStaffRecipientRow extends RowDataPacket {
  name: string
  notification_phone: string
  whatsapp_opt_in: number | boolean
  is_active: number | boolean
  role: 'admin' | 'barber'
  barber_id: string | null
}

interface NotificationIdRow extends RowDataPacket {
  id: string
}

interface RevisionRow extends RowDataPacket {
  notification_revision: number
}

interface QueueRecipient {
  audience: WhatsAppRecipientAudience
  kind: WhatsAppRecipientKind
  id: string
  name: string
  phone: string
  isCurrentBarber: boolean
}

interface ReadyNotification {
  kind: 'ready'
  id: string
  event: AppointmentWhatsAppEvent
  audience: WhatsAppRecipientAudience
  recipientPhone: string
  details: AppointmentWhatsAppDetails
  attempt: number
}

interface FinishedNotification {
  kind: 'finished'
  outcome: 'failed' | 'skipped'
}

export interface QueueAppointmentWhatsAppResult {
  revision: number
  notificationIds: string[]
  immediateNotificationIds: string[]
  eventQueued: number
  remindersQueued: number
}

export interface WhatsAppProcessingResult {
  recovered: number
  purged: number
  processed: number
  previewed: number
  accepted: number
  skipped: number
  retryScheduled: number
  failed: number
  superseded: number
}

export type WhatsAppDeliveryOutcome =
  | 'previewed'
  | 'accepted'
  | 'skipped'
  | 'retry_scheduled'
  | 'failed'
  | 'superseded'

export class WhatsAppQueueError extends Error {}

const notificationRetentionDays = 90
const notificationCleanupBatchSize = 1000
const notificationBatchSize = 50
const notificationConcurrency = 5
const maximumAttempts = 5
const processingLeaseMinutes = 15

function isDuplicateEntry(error: unknown) {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY',
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.replaceAll(/\s+/g, ' ').slice(0, 500)
  return 'Falha desconhecida ao enviar o aviso pelo WhatsApp.'
}

function toSqlDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function getZonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .filter((part) => part.type !== 'literal')

  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)])) as Record<
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
    number
  >
}

export function getAppointmentInstantInSaoPaulo(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute, second = 0] = time.split(':').map(Number)
  const desiredTimestamp = Date.UTC(year, month - 1, day, hour, minute, second)
  let timestamp = desiredTimestamp

  for (let pass = 0; pass < 3; pass += 1) {
    const zoned = getZonedParts(new Date(timestamp))
    const representedTimestamp = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    )
    const correction = desiredTimestamp - representedTimestamp
    timestamp += correction
    if (correction === 0) break
  }

  return new Date(timestamp)
}

export function getWhatsAppRetryDelaySeconds(attempt: number) {
  return Math.min(60 * 5 ** Math.max(attempt - 1, 0), 3_600)
}

function getEffectiveRecipient(phone: string) {
  if (process.env.NODE_ENV === 'production') return phone
  return process.env.WHATSAPP_TEST_RECIPIENT?.trim() || phone
}

function isAppointmentWhatsAppDetails(value: unknown): value is AppointmentWhatsAppDetails {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return [
    'recipientName',
    'customerName',
    'serviceName',
    'barberName',
    'dateLabel',
    'time',
    'priceLabel',
    'businessName',
  ].every((key) => typeof record[key] === 'string' && record[key].length <= 512)
}

function parseDetailsSnapshot(value: unknown) {
  let parsed = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  return isAppointmentWhatsAppDetails(parsed) ? parsed : null
}

function getExpectedAppointmentStatus(event: AppointmentWhatsAppEvent) {
  return event === 'appointment_cancelled' ? 'cancelado' : 'confirmado'
}

function buildDetails(appointment: AppointmentQueueRow, recipientName: string) {
  return {
    recipientName,
    customerName: appointment.customer_name,
    serviceName: appointment.service_name,
    barberName: appointment.barber_name,
    dateLabel: formatDateLong(appointment.appointment_date),
    time: appointment.appointment_time.slice(0, 5),
    priceLabel: formatPrice(appointment.price),
    businessName: appointment.business_name,
  } satisfies AppointmentWhatsAppDetails
}

function createDedupeKey({
  appointmentId,
  revision,
  event,
  recipient,
}: {
  appointmentId: string
  revision: number
  event: AppointmentWhatsAppEvent
  recipient: QueueRecipient
}) {
  return [
    'appointment',
    appointmentId,
    revision,
    event,
    recipient.audience,
    recipient.kind,
    recipient.id,
  ].join(':')
}

async function insertNotification(
  connection: PoolConnection,
  {
    appointment,
    event,
    recipient,
    scheduledFor,
  }: {
    appointment: AppointmentQueueRow
    event: AppointmentWhatsAppEvent
    recipient: QueueRecipient
    scheduledFor: Date
  },
) {
  const id = randomUUID()
  const scheduledForSql = toSqlDateTime(scheduledFor)

  try {
    await connection.execute<ResultSetHeader>(
      `INSERT INTO whatsapp_notifications
        (id, appointment_id, appointment_revision, event, audience, recipient_kind,
         recipient_id, recipient_phone, recipient_name, details_snapshot, scheduled_for,
         next_attempt_at, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        appointment.id,
        appointment.notification_revision,
        event,
        recipient.audience,
        recipient.kind,
        recipient.id,
        recipient.phone,
        recipient.name,
        JSON.stringify(buildDetails(appointment, recipient.name)),
        scheduledForSql,
        scheduledForSql,
        createDedupeKey({
          appointmentId: appointment.id,
          revision: appointment.notification_revision,
          event,
          recipient,
        }),
      ],
    )
    return id
  } catch (error) {
    if (isDuplicateEntry(error)) return null
    throw error
  }
}

async function getQueueRecipients(
  connection: PoolConnection,
  appointment: AppointmentQueueRow,
  previousBarberId?: string,
) {
  const recipients: QueueRecipient[] = []

  if (Boolean(appointment.customer_whatsapp_opt_in) && appointment.customer_phone) {
    recipients.push({
      audience: 'customer',
      kind: 'customer',
      id: appointment.customer_id,
      name: appointment.customer_name,
      phone: appointment.customer_phone,
      isCurrentBarber: false,
    })
  }

  const barberIds = [
    ...new Set(
      [appointment.barber_id, previousBarberId].filter(
        (barberId): barberId is string => Boolean(barberId),
      ),
    ),
  ]
  if (barberIds.length > 0) {
    const placeholders = barberIds.map(() => '?').join(', ')
    const [barbers] = await connection.execute<StaffRecipientRow[]>(
      `SELECT id, name, notification_phone, role, barber_id
       FROM staff_users
       WHERE role = 'barber'
         AND barber_id IN (${placeholders})
         AND is_active = TRUE
         AND whatsapp_opt_in = TRUE
         AND notification_phone <> ''`,
      barberIds,
    )
    for (const barber of barbers) {
      recipients.push({
        audience: 'barber',
        kind: 'staff',
        id: barber.id,
        name: barber.name,
        phone: barber.notification_phone,
        isCurrentBarber: barber.barber_id === appointment.barber_id,
      })
    }
  }

  const [admins] = await connection.execute<StaffRecipientRow[]>(
    `SELECT id, name, notification_phone, role, barber_id
     FROM staff_users
     WHERE role = 'admin'
       AND is_active = TRUE
       AND whatsapp_opt_in = TRUE
       AND notification_phone <> ''`,
  )
  for (const admin of admins) {
    recipients.push({
      audience: 'admin',
      kind: 'staff',
      id: admin.id,
      name: admin.name,
      phone: admin.notification_phone,
      isCurrentBarber: false,
    })
  }

  return recipients
}

export async function incrementAppointmentNotificationRevision(
  connection: PoolConnection,
  appointmentId: string,
) {
  const [result] = await connection.execute<ResultSetHeader>(
    `UPDATE appointments
     SET notification_revision = notification_revision + 1
     WHERE id = ?`,
    [appointmentId],
  )
  if (result.affectedRows !== 1) {
    throw new WhatsAppQueueError('O agendamento não foi encontrado para atualizar os avisos.')
  }

  const [rows] = await connection.execute<RevisionRow[]>(
    'SELECT notification_revision FROM appointments WHERE id = ? LIMIT 1',
    [appointmentId],
  )
  if (!rows[0]) {
    throw new WhatsAppQueueError('Não foi possível ler a revisão dos avisos do agendamento.')
  }
  return rows[0].notification_revision
}

export async function supersedeAppointmentWhatsAppNotifications(
  connection: PoolConnection,
  {
    appointmentId,
    revision,
    reason = 'Substituído por uma versão mais recente do agendamento.',
  }: {
    appointmentId: string
    revision?: number
    reason?: string
  },
) {
  const parameters: Array<string | number> = [reason.slice(0, 500), appointmentId]
  const revisionCondition = revision === undefined ? '' : 'AND appointment_revision < ?'
  if (revision !== undefined) parameters.push(revision)

  const [result] = await connection.execute<ResultSetHeader>(
    `UPDATE whatsapp_notifications
     SET status = 'superseded', locked_at = NULL, last_error = ?
     WHERE appointment_id = ?
       AND status = 'pending'
       ${revisionCondition}`,
    parameters,
  )
  return result.affectedRows
}

export async function queueAppointmentWhatsAppNotifications(
  connection: PoolConnection,
  {
    appointmentId,
    event,
    previousBarberId,
  }: {
    appointmentId: string
    event: AppointmentMutationEvent
    previousBarberId?: string
  },
): Promise<QueueAppointmentWhatsAppResult> {
  const [rows] = await connection.execute<AppointmentQueueRow[]>(
    `SELECT
      appointments.id,
      appointments.customer_id,
      appointments.barber_id,
      appointments.notification_revision,
      appointments.status,
      appointments.appointment_date,
      appointments.appointment_time,
      appointments.price,
      customers.name AS customer_name,
      customers.phone AS customer_phone,
      customers.whatsapp_opt_in AS customer_whatsapp_opt_in,
      services.name AS service_name,
      barbers.name AS barber_name,
      business_settings.name AS business_name
     FROM appointments
     INNER JOIN customers ON customers.id = appointments.customer_id
     INNER JOIN services ON services.id = appointments.service_id
     INNER JOIN barbers ON barbers.id = appointments.barber_id
     INNER JOIN business_settings ON business_settings.id = 1
     WHERE appointments.id = ?
     LIMIT 1
     FOR SHARE`,
    [appointmentId],
  )
  const appointment = rows[0]
  if (!appointment) throw new WhatsAppQueueError('O agendamento não foi encontrado para os avisos.')
  if (appointment.status !== getExpectedAppointmentStatus(event)) {
    throw new WhatsAppQueueError('O status do agendamento não corresponde ao aviso solicitado.')
  }

  await connection.execute<ResultSetHeader>(
    `UPDATE whatsapp_notifications
     SET status = 'superseded', locked_at = NULL,
       last_error = 'Substituído por uma versão mais recente do agendamento.'
     WHERE appointment_id = ?
       AND status = 'pending'
       AND (
         appointment_revision < ?
         OR (? = 'appointment_cancelled' AND event IN ('reminder_24h', 'reminder_2h'))
       )`,
    [appointment.id, appointment.notification_revision, event],
  )

  const recipients = await getQueueRecipients(connection, appointment, previousBarberId)
  const notificationIds: string[] = []
  const immediateNotificationIds: string[] = []
  const now = new Date()

  for (const recipient of recipients) {
    const id = await insertNotification(connection, {
      appointment,
      event,
      recipient,
      scheduledFor: now,
    })
    if (id) {
      notificationIds.push(id)
      immediateNotificationIds.push(id)
    }
  }

  let remindersQueued = 0
  if (event !== 'appointment_cancelled') {
    const appointmentInstant = getAppointmentInstantInSaoPaulo(
      appointment.appointment_date,
      appointment.appointment_time,
    )
    const reminders = [
      { event: 'reminder_24h' as const, millisecondsBefore: 24 * 60 * 60 * 1000 },
      { event: 'reminder_2h' as const, millisecondsBefore: 2 * 60 * 60 * 1000 },
    ]

    for (const reminder of reminders) {
      const scheduledFor = new Date(appointmentInstant.getTime() - reminder.millisecondsBefore)
      if (scheduledFor <= now) continue

      for (const recipient of recipients) {
        if (recipient.audience === 'barber' && !recipient.isCurrentBarber) continue
        const id = await insertNotification(connection, {
          appointment,
          event: reminder.event,
          recipient,
          scheduledFor,
        })
        if (id) {
          notificationIds.push(id)
          remindersQueued += 1
        }
      }
    }
  }

  return {
    revision: appointment.notification_revision,
    notificationIds,
    immediateNotificationIds,
    eventQueued: immediateNotificationIds.length,
    remindersQueued,
  }
}

async function finishWithoutDelivery(
  connection: PoolConnection,
  id: string,
  outcome: FinishedNotification['outcome'],
  reason: string,
) {
  await connection.execute<ResultSetHeader>(
    `UPDATE whatsapp_notifications
     SET status = ?, locked_at = NULL, last_error = ?
     WHERE id = ?`,
    [outcome, reason.slice(0, 500), id],
  )
  return { kind: 'finished', outcome } satisfies FinishedNotification
}

async function claimWhatsAppNotification(
  id: string,
): Promise<ReadyNotification | FinishedNotification | null> {
  const [references] = await getPool().execute<NotificationReferenceRow[]>(
    'SELECT appointment_id FROM whatsapp_notifications WHERE id = ? LIMIT 1',
    [id],
  )
  const reference = references[0]
  if (!reference) return null
  if (!reference.appointment_id) {
    const [result] = await getPool().execute<ResultSetHeader>(
      `UPDATE whatsapp_notifications
       SET status = 'skipped', locked_at = NULL,
         last_error = 'O agendamento foi removido antes do envio deste aviso.'
       WHERE id = ? AND status = 'pending'`,
      [id],
    )
    return result.affectedRows === 1
      ? ({ kind: 'finished', outcome: 'skipped' } satisfies FinishedNotification)
      : null
  }

  return withTransaction(async (connection) => {
    const [appointments] = await connection.execute<AppointmentValidationRow[]>(
      `SELECT notification_revision, status, barber_id
       FROM appointments
       WHERE id = ?
       LIMIT 1
       FOR SHARE`,
      [reference.appointment_id],
    )
    const appointment = appointments[0]
    if (!appointment) return null

    const [notifications] = await connection.execute<NotificationRow[]>(
      `SELECT id, appointment_id, appointment_revision, event, audience, recipient_kind,
        recipient_id, recipient_phone, recipient_name, details_snapshot, status, attempts
       FROM whatsapp_notifications
       WHERE id = ?
         AND appointment_id = ?
         AND status = 'pending'
         AND scheduled_for <= UTC_TIMESTAMP()
         AND next_attempt_at <= UTC_TIMESTAMP()
         AND attempts < ?
       LIMIT 1
       FOR UPDATE`,
      [id, reference.appointment_id, maximumAttempts],
    )
    const notification = notifications[0]
    if (!notification) return null

    if (
      appointment.notification_revision !== notification.appointment_revision ||
      appointment.status !== getExpectedAppointmentStatus(notification.event)
    ) {
      return finishWithoutDelivery(
        connection,
        id,
        'skipped',
        'O agendamento foi alterado e este aviso ficou desatualizado.',
      )
    }

    const details = parseDetailsSnapshot(notification.details_snapshot)
    if (!details) {
      return finishWithoutDelivery(
        connection,
        id,
        'failed',
        'O conteúdo armazenado para o aviso é inválido.',
      )
    }

    let recipientName: string
    let recipientPhone: string
    if (notification.recipient_kind === 'customer' && notification.audience === 'customer') {
      const [customers] = await connection.execute<CustomerRecipientRow[]>(
        `SELECT name, phone, whatsapp_opt_in
         FROM customers
         WHERE id = ?
         LIMIT 1`,
        [notification.recipient_id],
      )
      const customer = customers[0]
      if (!customer || !Boolean(customer.whatsapp_opt_in) || !customer.phone) {
        return finishWithoutDelivery(
          connection,
          id,
          'skipped',
          'O cliente não possui mais consentimento ou telefone para WhatsApp.',
        )
      }
      recipientName = customer.name
      recipientPhone = customer.phone
    } else if (notification.recipient_kind === 'staff' && notification.audience !== 'customer') {
      const [staffUsers] = await connection.execute<CurrentStaffRecipientRow[]>(
        `SELECT name, notification_phone, whatsapp_opt_in, is_active, role, barber_id
         FROM staff_users
         WHERE id = ?
         LIMIT 1`,
        [notification.recipient_id],
      )
      const staff = staffUsers[0]
      const expectedRole = notification.audience === 'admin' ? 'admin' : 'barber'
      const isCurrentReminderBarber =
        notification.audience !== 'barber' ||
        !notification.event.startsWith('reminder_') ||
        staff?.barber_id === appointment.barber_id
      if (
        !staff ||
        !Boolean(staff.is_active) ||
        !Boolean(staff.whatsapp_opt_in) ||
        !staff.notification_phone ||
        staff.role !== expectedRole ||
        !isCurrentReminderBarber
      ) {
        return finishWithoutDelivery(
          connection,
          id,
          'skipped',
          'O acesso da equipe não está mais apto a receber este aviso.',
        )
      }
      recipientName = staff.name
      recipientPhone = staff.notification_phone
    } else {
      return finishWithoutDelivery(
        connection,
        id,
        'failed',
        'O tipo de destinatário armazenado para o aviso é inválido.',
      )
    }

    const attempt = notification.attempts + 1
    await connection.execute<ResultSetHeader>(
      `UPDATE whatsapp_notifications
       SET status = 'processing', attempts = ?, locked_at = UTC_TIMESTAMP(),
         recipient_name = ?, recipient_phone = ?, last_error = NULL
       WHERE id = ?`,
      [attempt, recipientName, recipientPhone, id],
    )

    return {
      kind: 'ready',
      id,
      event: notification.event,
      audience: notification.audience,
      recipientPhone,
      details: { ...details, recipientName },
      attempt,
    }
  })
}

async function updateDeliveredStatus(
  notification: ReadyNotification,
  status: Extract<WhatsAppNotificationStatus, 'previewed' | 'accepted' | 'skipped'>,
  providerMessageId?: string,
) {
  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE whatsapp_notifications
     SET status = ?, locked_at = NULL, provider_message_id = ?,
       provider_status_at = IF(? = 'accepted', UTC_TIMESTAMP(), provider_status_at),
       last_error = NULL
     WHERE id = ? AND status = 'processing'`,
    [status, providerMessageId ?? null, status, notification.id],
  )
  return result.affectedRows === 1
}

export async function deliverWhatsAppNotification(
  id: string,
): Promise<WhatsAppDeliveryOutcome | null> {
  const claim = await claimWhatsAppNotification(id)
  if (!claim) return null
  if (claim.kind === 'finished') return claim.outcome

  try {
    const result = await sendAppointmentWhatsApp({
      to: getEffectiveRecipient(claim.recipientPhone),
      event: claim.event,
      audience: claim.audience,
      details: claim.details,
    })
    const status = result.previewed ? 'previewed' : result.accepted ? 'accepted' : 'skipped'
    const updated = await updateDeliveredStatus(claim, status, result.messageId)
    return updated ? status : 'superseded'
  } catch (error) {
    const retryable = error instanceof WhatsAppDeliveryError && error.retryable
    const shouldRetry = retryable && claim.attempt < maximumAttempts
    const nextAttempt = new Date(
      Date.now() + getWhatsAppRetryDelaySeconds(claim.attempt) * 1000,
    )
    const [result] = await getPool().execute<ResultSetHeader>(
      `UPDATE whatsapp_notifications
       SET status = ?, locked_at = NULL, next_attempt_at = ?, last_error = ?
       WHERE id = ? AND status = 'processing'`,
      [
        shouldRetry ? 'pending' : 'failed',
        toSqlDateTime(nextAttempt),
        getErrorMessage(error),
        claim.id,
      ],
    )
    if (result.affectedRows !== 1) return 'superseded'
    return shouldRetry ? 'retry_scheduled' : 'failed'
  }
}

async function processInBatches(ids: string[]) {
  const outcomes: WhatsAppDeliveryOutcome[] = []
  for (let index = 0; index < ids.length; index += notificationConcurrency) {
    const batch = ids.slice(index, index + notificationConcurrency)
    const batchResults = await Promise.all(batch.map(deliverWhatsAppNotification))
    outcomes.push(...batchResults.filter((result) => result !== null))
  }
  return outcomes
}

export async function processWhatsAppNotificationIds(ids: string[]) {
  const uniqueIds = [...new Set(ids)].slice(0, notificationBatchSize)
  return processInBatches(uniqueIds)
}

export async function processImmediateAppointmentWhatsAppNotifications(
  appointmentId: string,
) {
  const [notifications] = await getPool().execute<NotificationIdRow[]>(
    `SELECT whatsapp_notifications.id
     FROM whatsapp_notifications
     INNER JOIN appointments
       ON appointments.id = whatsapp_notifications.appointment_id
       AND appointments.notification_revision = whatsapp_notifications.appointment_revision
     WHERE whatsapp_notifications.appointment_id = ?
       AND whatsapp_notifications.status = 'pending'
       AND whatsapp_notifications.event IN (
         'appointment_created',
         'appointment_rescheduled',
         'appointment_cancelled'
       )
       AND whatsapp_notifications.scheduled_for <= UTC_TIMESTAMP()
       AND whatsapp_notifications.next_attempt_at <= UTC_TIMESTAMP()
     ORDER BY whatsapp_notifications.created_at ASC
     LIMIT ${notificationBatchSize}`,
    [appointmentId],
  )

  return processWhatsAppNotificationIds(notifications.map(({ id }) => id))
}

export async function processWhatsAppNotifications(): Promise<WhatsAppProcessingResult> {
  const pool = getPool()

  await pool.execute<ResultSetHeader>(
    `UPDATE whatsapp_notifications
     SET status = 'failed', locked_at = NULL,
       last_error = 'O limite de tentativas foi atingido durante um processamento interrompido.'
     WHERE status = 'processing'
       AND attempts >= ?
       AND locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${processingLeaseMinutes} MINUTE)`,
    [maximumAttempts],
  )
  const [recoveryResult] = await pool.execute<ResultSetHeader>(
    `UPDATE whatsapp_notifications
     SET status = 'pending', locked_at = NULL, next_attempt_at = UTC_TIMESTAMP(),
       last_error = 'Processamento anterior interrompido; uma nova tentativa foi agendada.'
     WHERE status = 'processing'
       AND attempts < ?
       AND locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${processingLeaseMinutes} MINUTE)`,
    [maximumAttempts],
  )
  const [cleanupResult] = await pool.execute<ResultSetHeader>(
    `DELETE FROM whatsapp_notifications
     WHERE status NOT IN ('pending', 'processing')
       AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${notificationRetentionDays} DAY)
     ORDER BY created_at ASC
     LIMIT ${notificationCleanupBatchSize}`,
  )
  const [notifications] = await pool.execute<NotificationIdRow[]>(
    `SELECT id
     FROM whatsapp_notifications
     WHERE status = 'pending'
       AND scheduled_for <= UTC_TIMESTAMP()
       AND next_attempt_at <= UTC_TIMESTAMP()
       AND attempts < ?
     ORDER BY scheduled_for ASC, created_at ASC
     LIMIT ${notificationBatchSize}`,
    [maximumAttempts],
  )
  const outcomes = await processInBatches(notifications.map(({ id }) => id))

  return {
    recovered: recoveryResult.affectedRows,
    purged: cleanupResult.affectedRows,
    processed: outcomes.length,
    previewed: outcomes.filter((outcome) => outcome === 'previewed').length,
    accepted: outcomes.filter((outcome) => outcome === 'accepted').length,
    skipped: outcomes.filter((outcome) => outcome === 'skipped').length,
    retryScheduled: outcomes.filter((outcome) => outcome === 'retry_scheduled').length,
    failed: outcomes.filter((outcome) => outcome === 'failed').length,
    superseded: outcomes.filter((outcome) => outcome === 'superseded').length,
  }
}
