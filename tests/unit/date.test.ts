import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDaysToIsoDate,
  getNowInSaoPaulo,
  getTodayInSaoPaulo,
  isValidIsoDate,
  isValidTime,
} from '@/lib/date'

afterEach(() => {
  vi.useRealTimers()
})

describe('datas e horários', () => {
  it.each([
    ['2024-02-28', 1, '2024-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-01-01', -1, '2025-12-31'],
  ])('soma %i dia(s) a %s', (date, days, expected) => {
    expect(addDaysToIsoDate(date, days)).toBe(expected)
  })

  it('reconhece apenas datas ISO reais', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('2026-09-19')).toBe(true)

    for (const invalidDate of [
      '2026-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-04-31',
      '2026-9-19',
      ' 2026-09-19',
    ]) {
      expect(isValidIsoDate(invalidDate)).toBe(false)
    }
  })

  it('reconhece horários completos de 00:00 a 23:59', () => {
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)

    for (const invalidTime of ['24:00', '09:60', '9:00', '09:0', ' 09:00']) {
      expect(isValidTime(invalidTime)).toBe(false)
    }
  })

  it('calcula a data e o horário no fuso de São Paulo', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T02:59:00.000Z'))

    expect(getTodayInSaoPaulo()).toBe('2025-12-31')
    expect(getNowInSaoPaulo()).toEqual({ date: '2025-12-31', time: '23:59' })
  })
})
