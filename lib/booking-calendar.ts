import { addDaysToIsoDate, isValidIsoDate, isValidTime } from '@/lib/date'
import type { BusinessHour } from '@/lib/types'

export const MAX_BOOKING_DAYS_AHEAD = 90

export type BookingDayStatus = 'available' | 'closed' | 'full'

export interface BookingDayAvailability {
  date: string
  status: BookingDayStatus
}

export interface BookingAvailabilityPeriod {
  from: string
  to: string
}

export interface BookableDay {
  iso: string
  weekday: string
  day: string
  month: string
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

export function isBookingDayAvailability(value: unknown): value is BookingDayAvailability {
  if (!value || typeof value !== 'object') return false

  const day = value as Partial<BookingDayAvailability>
  return (
    typeof day.date === 'string' &&
    isValidIsoDate(day.date) &&
    (day.status === 'available' || day.status === 'closed' || day.status === 'full')
  )
}

export function getBookingAvailabilityPeriod(
  yearMonth: string,
  today: string,
  maxDaysAhead = MAX_BOOKING_DAYS_AHEAD,
): BookingAvailabilityPeriod | null {
  if (
    !/^\d{4}-\d{2}$/.test(yearMonth) ||
    !isValidIsoDate(`${yearMonth}-01`) ||
    !isValidIsoDate(today) ||
    !Number.isInteger(maxDaysAhead) ||
    maxDaysAhead < 0
  ) {
    return null
  }

  const [year, month] = yearMonth.split('-').map(Number)
  const monthStart = `${yearMonth}-01`
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  const bookingLimit = addDaysToIsoDate(today, maxDaysAhead)
  const from = monthStart < today ? today : monthStart
  const to = monthEnd > bookingLimit ? bookingLimit : monthEnd

  return from <= to ? { from, to } : null
}

function isUsableBusinessHour(hour: BusinessHour) {
  return (
    Number.isInteger(hour.weekday) &&
    hour.weekday >= 0 &&
    hour.weekday <= 6 &&
    hour.isOpen &&
    hour.openTime !== null &&
    hour.closeTime !== null &&
    isValidTime(hour.openTime) &&
    isValidTime(hour.closeTime) &&
    hour.openTime < hour.closeTime
  )
}

export function getBookableDays(
  today: string,
  businessHours: readonly BusinessHour[],
  maxDaysAhead = MAX_BOOKING_DAYS_AHEAD,
) {
  if (!isValidIsoDate(today) || !Number.isInteger(maxDaysAhead) || maxDaysAhead < 0) return []

  const openWeekdays = new Set(
    businessHours.filter(isUsableBusinessHour).map((hour) => hour.weekday),
  )
  const days: BookableDay[] = []

  for (let offset = 0; offset <= maxDaysAhead; offset += 1) {
    const iso = addDaysToIsoDate(today, offset)
    const date = new Date(`${iso}T12:00:00.000Z`)
    const weekday = date.getUTCDay()

    if (!openWeekdays.has(weekday)) continue

    days.push({
      iso,
      weekday: WEEKDAYS[weekday],
      day: String(date.getUTCDate()).padStart(2, '0'),
      month: MONTHS[date.getUTCMonth()],
    })
  }

  return days
}
