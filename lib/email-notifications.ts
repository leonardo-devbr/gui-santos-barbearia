import 'server-only'

import { randomUUID } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getBusinessConfiguration } from '@/lib/business'
import { getPool, withTransaction } from '@/lib/db'
import { addDaysToIsoDate, getTodayInSaoPaulo } from '@/lib/date'
import { getPublicAppUrl, sendEmail } from '@/lib/email'
import {
  createAppointmentEmail,
  type AppointmentEmailType,
} from '@/lib/email-templates'
import { formatDateLong, formatPrice } from '@/lib/format'

interface AppointmentNotificationRow extends RowDataPacket {
  id: string
  customer_id: string
  customer_name: string
  customer_email: string
  service_name: string
  barber_name: string
  appointment_date: string
  appointment_time: string
  price: number
}

interface PendingNotificationRow extends RowDataPacket {
  id: string
  recipient_email: string
  subject: string
  text_body: string
  html_body: string
  status: 'pending' | 'processing' | 'sent' | 'failed'
  attempt_count: number
}

interface AppointmentIdRow extends RowDataPacket {
  id: string
}

interface NotificationIdRow extends RowDataPacket {
  id: string
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500)
  return 'Falha desconhecida ao enviar o e-mail.'
}

async function createNotification(
  appointmentId: string,
  type: AppointmentEmailType,
  dedupeKey?: string,
) {
  const [rows] = await getPool().execute<AppointmentNotificationRow[]>(
    `SELECT
      appointments.id,
      appointments.customer_id,
      customers.name AS customer_name,
      customers.email AS customer_email,
      services.name AS service_name,
      barbers.name AS barber_name,
      appointments.appointment_date,
      appointments.appointment_time,
      appointments.price
    FROM appointments
    INNER JOIN customers ON customers.id = appointments.customer_id
    INNER JOIN services ON services.id = appointments.service_id
    INNER JOIN barbers ON barbers.id = appointments.barber_id
    WHERE appointments.id = ?
    LIMIT 1`,
    [appointmentId],
  )
  const appointment = rows[0]
  if (!appointment) return null

  const { settings } = await getBusinessConfiguration()
  const appointmentsUrl = `${getPublicAppUrl()}/app/agendamentos`
  const template = createAppointmentEmail(type, {
    customerName: appointment.customer_name,
    serviceName: appointment.service_name,
    barberName: appointment.barber_name,
    dateLabel: formatDateLong(appointment.appointment_date),
    time: appointment.appointment_time.slice(0, 5),
    priceLabel: formatPrice(appointment.price),
    businessName: settings.name,
    appointmentsUrl,
  })

  const id = randomUUID()
  try {
    await getPool().execute<ResultSetHeader>(
      `INSERT INTO email_notifications
        (id, customer_id, appointment_id, notification_type, recipient_email,
         recipient_name, subject, text_body, html_body, scheduled_for, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)`,
      [
        id,
        appointment.customer_id,
        appointment.id,
        type,
        appointment.customer_email,
        appointment.customer_name,
        template.subject,
        template.text,
        template.html,
        dedupeKey ?? null,
      ],
    )
    return id
  } catch (error) {
    if (dedupeKey && isDuplicateEntry(error)) return null
    throw error
  }
}

export async function deliverEmailNotification(id: string) {
  const notification = await withTransaction(async (connection) => {
    const [rows] = await connection.execute<PendingNotificationRow[]>(
      `SELECT id, recipient_email, subject, text_body, html_body, status, attempt_count
       FROM email_notifications
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id],
    )
    const row = rows[0]
    if (!row || !['pending', 'failed'].includes(row.status) || row.attempt_count >= 3) {
      return null
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE email_notifications
       SET status = 'processing', attempt_count = attempt_count + 1, last_error = NULL
       WHERE id = ?`,
      [id],
    )
    return row
  })
  if (!notification) return false

  try {
    await sendEmail({
      to: notification.recipient_email,
      subject: notification.subject,
      text: notification.text_body,
      html: notification.html_body,
    })
    await getPool().execute<ResultSetHeader>(
      `UPDATE email_notifications
       SET status = 'sent', sent_at = UTC_TIMESTAMP(), last_error = NULL
       WHERE id = ?`,
      [id],
    )
    return true
  } catch (error) {
    await getPool().execute<ResultSetHeader>(
      `UPDATE email_notifications
       SET status = 'failed', last_error = ?
       WHERE id = ?`,
      [getErrorMessage(error), id],
    )
    console.error(`Falha ao enviar notificação ${id}:`, error)
    return false
  }
}

export async function notifyAppointment(appointmentId: string, type: AppointmentEmailType) {
  try {
    const notificationId = await createNotification(appointmentId, type)
    return notificationId ? deliverEmailNotification(notificationId) : false
  } catch (error) {
    console.error(`Falha ao preparar notificação de ${type}:`, error)
    return false
  }
}

export async function queueAppointmentReminder(appointmentId: string, dedupeKey: string) {
  return createNotification(appointmentId, 'appointment_reminder', dedupeKey)
}

export async function processAppointmentNotifications() {
  const pool = getPool()
  const reminderDate = addDaysToIsoDate(getTodayInSaoPaulo(), 1)

  await pool.execute<ResultSetHeader>(
    `UPDATE email_notifications
     SET status = 'failed', last_error = 'Processamento interrompido antes da conclusão.'
     WHERE status = 'processing'
       AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)`,
  )

  const [appointments] = await pool.execute<AppointmentIdRow[]>(
    `SELECT id
     FROM appointments
     WHERE appointment_date = ? AND status IN ('confirmado', 'pendente')
     ORDER BY appointment_time ASC`,
    [reminderDate],
  )

  let queued = 0
  for (const appointment of appointments) {
    const notificationId = await queueAppointmentReminder(
      appointment.id,
      `appointment-reminder:${appointment.id}:${reminderDate}`,
    )
    if (notificationId) queued += 1
  }

  const [notifications] = await pool.execute<NotificationIdRow[]>(
    `SELECT id
     FROM email_notifications
     WHERE status IN ('pending', 'failed')
       AND scheduled_for <= UTC_TIMESTAMP()
       AND attempt_count < 3
     ORDER BY scheduled_for ASC, created_at ASC
     LIMIT 50`,
  )
  const results = await Promise.all(
    notifications.map((notification) => deliverEmailNotification(notification.id)),
  )
  const sent = results.filter(Boolean).length

  return {
    reminderDate,
    queued,
    processed: notifications.length,
    sent,
    failed: notifications.length - sent,
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
