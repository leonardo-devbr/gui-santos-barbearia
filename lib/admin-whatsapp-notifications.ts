import 'server-only'

import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'
import { maskWhatsAppNumber } from '@/lib/whatsapp'

export const adminWhatsAppStatuses = [
  'pending',
  'processing',
  'previewed',
  'accepted',
  'sent',
  'delivered',
  'read',
  'failed',
  'skipped',
  'superseded',
] as const

export const adminWhatsAppEvents = [
  'appointment_created',
  'appointment_rescheduled',
  'appointment_cancelled',
  'reminder_24h',
  'reminder_2h',
] as const

export type AdminWhatsAppStatus = (typeof adminWhatsAppStatuses)[number]
export type AdminWhatsAppEvent = (typeof adminWhatsAppEvents)[number]
export type AdminWhatsAppAudience = 'customer' | 'barber' | 'admin'

export interface AdminWhatsAppFilters {
  status?: AdminWhatsAppStatus
  event?: AdminWhatsAppEvent
}

export interface AdminWhatsAppNotification {
  id: string
  event: AdminWhatsAppEvent
  audience: AdminWhatsAppAudience
  recipientName: string
  maskedRecipientPhone: string
  status: AdminWhatsAppStatus
  attempts: number
  scheduledFor: string
  createdAt: string
  safeError: string | null
  details: {
    customerName: string
    serviceName: string
    barberName: string
    dateLabel: string
    time: string
  }
}

interface AdminWhatsAppRow extends RowDataPacket {
  id: string
  event: AdminWhatsAppEvent
  audience: AdminWhatsAppAudience
  recipient_name: string
  recipient_phone: string
  details_snapshot: unknown
  status: AdminWhatsAppStatus
  attempts: number
  scheduled_for: string
  created_at: string
  last_error: string | null
}

const statusSet = new Set<string>(adminWhatsAppStatuses)
const eventSet = new Set<string>(adminWhatsAppEvents)

function readSingleSearchValue(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseAdminWhatsAppFilters(values: {
  status?: string | string[]
  event?: string | string[]
}): AdminWhatsAppFilters {
  const status = readSingleSearchValue(values.status)
  const event = readSingleSearchValue(values.event)

  return {
    ...(statusSet.has(status) ? { status: status as AdminWhatsAppStatus } : {}),
    ...(eventSet.has(event) ? { event: event as AdminWhatsAppEvent } : {}),
  }
}

function readSnapshot(value: unknown) {
  let snapshot = value
  if (typeof value === 'string') {
    try {
      snapshot = JSON.parse(value)
    } catch {
      snapshot = null
    }
  }

  const record = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>) : {}
  const readText = (key: string) => {
    const field = record[key]
    return typeof field === 'string' && field.trim().length <= 512 ? field.trim() : 'Não informado'
  }

  return {
    customerName: readText('customerName'),
    serviceName: readText('serviceName'),
    barberName: readText('barberName'),
    dateLabel: readText('dateLabel'),
    time: readText('time'),
  }
}

export function getSafeAdminWhatsAppError(
  status: AdminWhatsAppStatus,
  attempts: number,
  hasStoredError: boolean,
) {
  if (!hasStoredError) return null
  if (status === 'superseded') {
    return 'O aviso foi substituído por uma versão mais recente do agendamento.'
  }
  if (status === 'skipped') {
    return 'O destinatário não estava mais apto a receber este aviso.'
  }
  if (status === 'failed') {
    return 'O aviso não pôde ser enviado. Consulte os logs do servidor para o diagnóstico técnico.'
  }
  if (status === 'pending' && attempts > 0) {
    return 'O envio falhou temporariamente e aguarda uma nova tentativa.'
  }
  if (status === 'processing') {
    return 'Uma tentativa anterior foi interrompida e está em recuperação.'
  }
  return null
}

export function formatAdminWhatsAppDateTime(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return 'Data indisponível'

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export async function getAdminWhatsAppNotifications(
  filters: AdminWhatsAppFilters = {},
): Promise<AdminWhatsAppNotification[]> {
  const conditions: string[] = []
  const parameters: string[] = []

  if (filters.status) {
    conditions.push('status = ?')
    parameters.push(filters.status)
  }
  if (filters.event) {
    conditions.push('event = ?')
    parameters.push(filters.event)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const [rows] = await getPool().execute<AdminWhatsAppRow[]>(
    `SELECT
       id, event, audience, recipient_name, recipient_phone, details_snapshot,
       status, attempts, scheduled_for, created_at, last_error
     FROM whatsapp_notifications
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT 100`,
    parameters,
  )

  return rows.map((row) => ({
    id: row.id,
    event: row.event,
    audience: row.audience,
    recipientName: row.recipient_name,
    maskedRecipientPhone: maskWhatsAppNumber(row.recipient_phone),
    status: row.status,
    attempts: row.attempts,
    scheduledFor: formatAdminWhatsAppDateTime(row.scheduled_for),
    createdAt: formatAdminWhatsAppDateTime(row.created_at),
    safeError: getSafeAdminWhatsAppError(row.status, row.attempts, Boolean(row.last_error)),
    details: readSnapshot(row.details_snapshot),
  }))
}
