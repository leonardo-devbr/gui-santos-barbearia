import { isValidIsoDate, isValidTime } from '@/lib/date'
import type { BusinessHour } from '@/lib/types'
import {
  isValidEmail,
  MAX_PASSWORD_LENGTH,
  normalizeEmail,
} from '@/lib/validation'

export type AdminBusinessFormField =
  | 'name'
  | 'street'
  | 'district'
  | 'city'
  | 'state'
  | 'postalCode'
  | 'phone'
  | 'email'
  | 'cnpj'
  | 'latitude'
  | 'longitude'
  | 'parkingInfo'
  | 'transitInfo'

export type AdminBusinessFormErrors = Partial<Record<AdminBusinessFormField, string>>

export type AdminScheduleBlockFormField =
  | 'barberId'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'reason'

export type AdminScheduleBlockFormErrors = Partial<
  Record<AdminScheduleBlockFormField, string>
>

export type AdminLoginFormField = 'email' | 'password'
export type AdminLoginFormErrors = Partial<Record<AdminLoginFormField, string>>

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function getApiMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback

  const message = (payload as Record<string, unknown>).message
  if (typeof message !== 'string') return fallback

  const normalized = message
    .trim()
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')

  return normalized && normalized.length <= 600 ? normalized : fallback
}

export function validateAdminBusinessForm(input: Record<AdminBusinessFormField, string>) {
  const errors: AdminBusinessFormErrors = {}
  const name = cleanText(input.name)
  const street = cleanText(input.street)
  const district = cleanText(input.district)
  const city = cleanText(input.city)
  const state = cleanText(input.state).toUpperCase()
  const postalCode = input.postalCode.replace(/\D/g, '')
  const phone = input.phone.replace(/\D/g, '')
  const email = normalizeEmail(input.email)
  const cnpj = input.cnpj.replace(/\D/g, '')
  const latitudeText = input.latitude.trim()
  const longitudeText = input.longitude.trim()
  const latitude = Number(latitudeText)
  const longitude = Number(longitudeText)
  const parkingInfo = cleanText(input.parkingInfo)
  const transitInfo = cleanText(input.transitInfo)

  if (name.length < 2 || name.length > 100) {
    errors.name = 'O nome deve ter entre 2 e 100 caracteres.'
  }
  if (street.length < 3 || street.length > 160) {
    errors.street = 'Informe um endereço válido.'
  }
  if (district.length < 2 || district.length > 100) {
    errors.district = 'Informe um bairro válido.'
  }
  if (city.length < 2 || city.length > 100) {
    errors.city = 'Informe uma cidade válida.'
  }
  if (!/^[A-Z]{2}$/.test(state)) {
    errors.state = 'Informe a sigla do estado com duas letras.'
  }
  if (postalCode.length !== 8) {
    errors.postalCode = 'Informe um CEP com 8 dígitos.'
  }
  if (phone.length < 10 || phone.length > 11) {
    errors.phone = 'Informe um telefone com DDD.'
  }
  if (!isValidEmail(email) || email.length > 254) {
    errors.email = 'Informe um e-mail válido.'
  }
  if (cnpj && cnpj.length !== 14) {
    errors.cnpj = 'Informe um CNPJ com 14 dígitos ou deixe o campo vazio.'
  }
  if (!latitudeText || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'Informe uma latitude válida.'
  }
  if (!longitudeText || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'Informe uma longitude válida.'
  }
  if (parkingInfo.length > 255) {
    errors.parkingInfo = 'A orientação de estacionamento deve ter no máximo 255 caracteres.'
  }
  if (transitInfo.length > 255) {
    errors.transitInfo = 'A orientação de transporte deve ter no máximo 255 caracteres.'
  }

  return {
    data: {
      name,
      street,
      district,
      city,
      state,
      postalCode,
      phone,
      email,
      cnpj,
      latitude,
      longitude,
      parkingInfo,
      transitInfo,
    },
    errors,
  }
}

function isHalfHourInterval(value: string) {
  if (!isValidTime(value)) return false
  return Number(value.slice(3)) % 30 === 0
}

export function validateAdminBusinessHours(hours: BusinessHour[]) {
  const invalidHour = hours.find(
    (hour) =>
      hour.isOpen &&
      (!hour.openTime ||
        !hour.closeTime ||
        !isHalfHourInterval(hour.openTime) ||
        !isHalfHourInterval(hour.closeTime) ||
        hour.openTime >= hour.closeTime),
  )

  if (!invalidHour) return null

  return {
    weekday: invalidHour.weekday,
    message:
      invalidHour.openTime &&
      invalidHour.closeTime &&
      isValidTime(invalidHour.openTime) &&
      isValidTime(invalidHour.closeTime) &&
      (!isHalfHourInterval(invalidHour.openTime) || !isHalfHourInterval(invalidHour.closeTime))
        ? 'Use horários em intervalos de 30 minutos.'
        : 'O horário de fechamento deve ser posterior ao de abertura.',
  }
}

export function validateAdminScheduleBlockForm(input: {
  barberId: string
  date: string
  fullDay: boolean
  startTime: string
  endTime: string
  reason: string
  today: string
}) {
  const errors: AdminScheduleBlockFormErrors = {}
  const barberId = input.barberId.trim()
  const date = input.date.trim()
  const startTime = input.startTime.trim()
  const endTime = input.endTime.trim()
  const reason = cleanText(input.reason)

  if (barberId !== 'all' && (!barberId || barberId.length > 64)) {
    errors.barberId = 'Selecione um barbeiro válido.'
  }
  if (!isValidIsoDate(date) || date < input.today) {
    errors.date = 'Escolha uma data atual ou futura.'
  }
  if (!input.fullDay) {
    if (!isValidTime(startTime)) errors.startTime = 'Selecione o horário de início.'
    if (!isValidTime(endTime)) errors.endTime = 'Selecione o horário de término.'
    if (isValidTime(startTime) && isValidTime(endTime) && startTime >= endTime) {
      errors.endTime = 'O horário de término deve ser posterior ao horário de início.'
    }
  }
  if (reason.length < 3 || reason.length > 160) {
    errors.reason = 'O motivo deve ter entre 3 e 160 caracteres.'
  }

  return {
    data: {
      barberId,
      date,
      fullDay: input.fullDay,
      startTime: input.fullDay ? null : startTime,
      endTime: input.fullDay ? null : endTime,
      reason,
    },
    errors,
  }
}

export function validateAdminLoginForm(input: { email: string; password: string }) {
  const errors: AdminLoginFormErrors = {}
  const email = normalizeEmail(input.email)

  if (!isValidEmail(email) || email.length > 254) {
    errors.email = 'Informe um e-mail válido.'
  }
  if (!input.password) {
    errors.password = 'Informe sua senha.'
  } else if (input.password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`
  }

  return { data: { email, password: input.password }, errors }
}
