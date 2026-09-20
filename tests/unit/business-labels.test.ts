import { describe, expect, it } from 'vitest'
import {
  formatBusinessHour,
  formatCnpj,
  formatPostalCode,
  getWeekdayLabel,
} from '@/lib/business-labels'

describe('rótulos do estabelecimento', () => {
  it('traduz os dias válidos da semana', () => {
    expect(getWeekdayLabel(0)).toBe('Domingo')
    expect(getWeekdayLabel(6)).toBe('Sábado')
    expect(getWeekdayLabel(-1)).toBe('')
    expect(getWeekdayLabel(7)).toBe('')
  })

  it('formata o expediente e trata horários fechados ou incompletos', () => {
    expect(
      formatBusinessHour({ weekday: 2, isOpen: true, openTime: '09:00', closeTime: '18:00' }),
    ).toBe('09:00 às 18:00')
    expect(
      formatBusinessHour({ weekday: 1, isOpen: false, openTime: null, closeTime: null }),
    ).toBe('Fechado')
    expect(
      formatBusinessHour({ weekday: 2, isOpen: true, openTime: '09:00', closeTime: null }),
    ).toBe('Fechado')
  })

  it('formata CEP e preserva valores incompletos', () => {
    expect(formatPostalCode('12345678')).toBe('12345-678')
    expect(formatPostalCode('12.345-678')).toBe('12345-678')
    expect(formatPostalCode('12.345')).toBe('12.345')
  })

  it('formata CNPJ e preserva valores incompletos', () => {
    expect(formatCnpj('12345678000190')).toBe('12.345.678/0001-90')
    expect(formatCnpj('12.345.678/0001-90')).toBe('12.345.678/0001-90')
    expect(formatCnpj('12345678')).toBe('12345678')
  })
})
