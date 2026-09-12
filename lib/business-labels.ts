import type { BusinessHour } from '@/lib/types'

const weekdayLabels = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

export function getWeekdayLabel(weekday: number) {
  return weekdayLabels[weekday] ?? ''
}

export function formatBusinessHour(hour: BusinessHour) {
  return hour.isOpen && hour.openTime && hour.closeTime
    ? `${hour.openTime} às ${hour.closeTime}`
    : 'Fechado'
}

export function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value
}

export function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14) return value
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}
