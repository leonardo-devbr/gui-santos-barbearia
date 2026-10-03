import { addDaysToIsoDate, isValidIsoDate, isValidTime } from '@/lib/date'
import type { AdminAppointment } from '@/lib/types'

export const agendaViews = ['day', 'week', 'month'] as const

export type AgendaView = (typeof agendaViews)[number]

export interface AgendaPeriod {
  startDate: string
  endDate: string
}

export interface AgendaFilters {
  serviceId: string
  customerId: string
  startTime: string
  endTime: string
}

export function isAgendaView(value: unknown): value is AgendaView {
  return agendaViews.includes(value as AgendaView)
}

export function getAgendaPeriod(referenceDate: string, view: AgendaView): AgendaPeriod {
  if (!isValidIsoDate(referenceDate)) throw new Error('A data de referência é inválida.')

  if (view === 'day') return { startDate: referenceDate, endDate: referenceDate }

  const date = new Date(`${referenceDate}T12:00:00.000Z`)

  if (view === 'week') {
    const daysSinceMonday = (date.getUTCDay() + 6) % 7
    const startDate = addDaysToIsoDate(referenceDate, -daysSinceMonday)
    return { startDate, endDate: addDaysToIsoDate(startDate, 6) }
  }

  const year = date.getUTCFullYear()
  const month = date.getUTCMonth()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const endDate = new Date(Date.UTC(year, month + 1, 0, 12)).toISOString().slice(0, 10)
  return { startDate, endDate }
}

export function shiftAgendaReference(
  referenceDate: string,
  view: AgendaView,
  direction: -1 | 1,
) {
  if (view === 'day') return addDaysToIsoDate(referenceDate, direction)
  if (view === 'week') return addDaysToIsoDate(referenceDate, direction * 7)

  const date = new Date(`${referenceDate}T12:00:00.000Z`)
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1, 12),
  )
    .toISOString()
    .slice(0, 10)
}

export function filterAdminAppointments(
  appointments: readonly AdminAppointment[],
  filters: AgendaFilters,
) {
  const startTime = isValidTime(filters.startTime) ? filters.startTime : ''
  const endTime = isValidTime(filters.endTime) ? filters.endTime : ''

  return appointments.filter((appointment) => {
    if (filters.serviceId && appointment.serviceId !== filters.serviceId) return false
    if (filters.customerId && appointment.customerId !== filters.customerId) return false
    if (startTime && appointment.time < startTime) return false
    if (endTime && appointment.time > endTime) return false
    return true
  })
}
