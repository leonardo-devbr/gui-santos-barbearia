import { describe, expect, it } from 'vitest'
import {
  getBookingAvailabilityPeriod,
  getBookableDays,
  isBookingDayAvailability,
  MAX_BOOKING_DAYS_AHEAD,
} from '@/lib/booking-calendar'
import { addDaysToIsoDate } from '@/lib/date'
import type { BusinessHour } from '@/lib/types'

function openHour(weekday: number): BusinessHour {
  return {
    weekday,
    isOpen: true,
    openTime: '09:00',
    closeTime: '18:00',
  }
}

describe('calendário de agendamento', () => {
  it('limita a consulta mensal ao período permitido para agendamento', () => {
    expect(getBookingAvailabilityPeriod('2026-09', '2026-09-21')).toEqual({
      from: '2026-09-21',
      to: '2026-09-30',
    })
    expect(getBookingAvailabilityPeriod('2026-12', '2026-09-21')).toEqual({
      from: '2026-12-01',
      to: '2026-12-20',
    })
    expect(getBookingAvailabilityPeriod('2026-08', '2026-09-21')).toBeNull()
  })

  it('valida somente estados reconhecidos de disponibilidade diária', () => {
    expect(isBookingDayAvailability({ date: '2026-09-22', status: 'available' })).toBe(true)
    expect(isBookingDayAvailability({ date: '2026-09-22', status: 'closed' })).toBe(true)
    expect(isBookingDayAvailability({ date: '2026-09-22', status: 'full' })).toBe(true)
    expect(isBookingDayAvailability({ date: '22/09/2026', status: 'available' })).toBe(false)
    expect(isBookingDayAvailability({ date: '2026-09-22', status: 'unknown' })).toBe(false)
  })

  it('inclui hoje e respeita os dias configurados no painel', () => {
    const days = getBookableDays('2026-09-21', [openHour(1)], 7)

    expect(days).toEqual([
      { iso: '2026-09-21', weekday: 'seg', day: '21', month: 'set' },
      { iso: '2026-09-28', weekday: 'seg', day: '28', month: 'set' },
    ])
  })

  it('não oferece dias fechados ou com expediente inválido', () => {
    const hours: BusinessHour[] = [
      { ...openHour(1), isOpen: false },
      { ...openHour(2), openTime: null },
      { ...openHour(3), closeTime: '08:00' },
      openHour(4),
    ]

    expect(getBookableDays('2026-09-21', hours, 6).map((day) => day.iso)).toEqual([
      '2026-09-24',
    ])
  })

  it('oferece todo o período aceito pelo backend, incluindo o último dia', () => {
    const hours = Array.from({ length: 7 }, (_, weekday) => openHour(weekday))
    const days = getBookableDays('2026-09-21', hours)

    expect(days).toHaveLength(MAX_BOOKING_DAYS_AHEAD + 1)
    expect(days.at(-1)?.iso).toBe(addDaysToIsoDate('2026-09-21', MAX_BOOKING_DAYS_AHEAD))
  })

  it('recusa uma data inicial ou um limite inválido', () => {
    expect(getBookableDays('21/09/2026', [openHour(1)])).toEqual([])
    expect(getBookableDays('2026-09-21', [openHour(1)], -1)).toEqual([])
  })
})
