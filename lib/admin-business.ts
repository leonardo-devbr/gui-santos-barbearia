import 'server-only'

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'
import { getBusinessConfiguration } from '@/lib/business'
import { isValidTime } from '@/lib/date'
import { getPool, withTransaction } from '@/lib/db'
import type { BusinessHour, BusinessSettings } from '@/lib/types'
import { isValidEmail, normalizeEmail, normalizePhone } from '@/lib/validation'

interface WeekdayRow extends RowDataPacket {
  weekday: number
}

export class AdminBusinessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function requireAdminAccess() {
  const admin = await getAuthenticatedAdmin()
  if (!admin) throw new AdminBusinessError('Acesso administrativo não autorizado.', 401)
}

export async function getAdminBusinessConfiguration() {
  await requireAdminAccess()
  return getBusinessConfiguration()
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function validateSettings(body: Record<string, unknown>): BusinessSettings {
  const name = cleanText(body.name)
  const street = cleanText(body.street)
  const district = cleanText(body.district)
  const city = cleanText(body.city)
  const state = cleanText(body.state).toUpperCase()
  const postalCode = cleanText(body.postalCode).replace(/\D/g, '')
  const rawPhone = cleanText(body.phone)
  const phone = normalizePhone(rawPhone)
  const email = normalizeEmail(cleanText(body.email))
  const latitude = Number(body.latitude)
  const longitude = Number(body.longitude)
  const parkingInfo = cleanText(body.parkingInfo)
  const transitInfo = cleanText(body.transitInfo)
  const cnpj = cleanText(body.cnpj).replace(/\D/g, '')

  if (name.length < 2 || name.length > 100) {
    throw new AdminBusinessError('O nome deve ter entre 2 e 100 caracteres.', 422)
  }
  if (street.length < 3 || street.length > 160) {
    throw new AdminBusinessError('Informe um endereço válido.', 422)
  }
  if (district.length < 2 || district.length > 100 || city.length < 2 || city.length > 100) {
    throw new AdminBusinessError('Informe bairro e cidade válidos.', 422)
  }
  if (!/^[A-Z]{2}$/.test(state)) {
    throw new AdminBusinessError('Informe a sigla do estado com duas letras.', 422)
  }
  if (postalCode.length !== 8) throw new AdminBusinessError('Informe um CEP com 8 dígitos.', 422)
  if (rawPhone.replace(/\D/g, '').length < 10 || rawPhone.replace(/\D/g, '').length > 11) {
    throw new AdminBusinessError('Informe um telefone com DDD.', 422)
  }
  if (!isValidEmail(email) || email.length > 254) {
    throw new AdminBusinessError('Informe um e-mail válido.', 422)
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new AdminBusinessError('Informe uma latitude válida.', 422)
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new AdminBusinessError('Informe uma longitude válida.', 422)
  }
  if (parkingInfo.length > 255 || transitInfo.length > 255) {
    throw new AdminBusinessError('As orientações de acesso devem ter no máximo 255 caracteres.', 422)
  }
  if (cnpj && cnpj.length !== 14) {
    throw new AdminBusinessError('Informe um CNPJ com 14 dígitos ou deixe o campo vazio.', 422)
  }

  return {
    name,
    street,
    district,
    city,
    state,
    postalCode,
    phone,
    email,
    latitude: Math.round(latitude * 10_000_000) / 10_000_000,
    longitude: Math.round(longitude * 10_000_000) / 10_000_000,
    parkingInfo,
    transitInfo,
    cnpj,
  }
}

function validateHours(body: Record<string, unknown>) {
  if (!Array.isArray(body.hours) || body.hours.length !== 7) {
    throw new AdminBusinessError('Envie os sete dias da semana.', 422)
  }

  const hours = body.hours.map((raw): BusinessHour => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new AdminBusinessError('Os horários informados são inválidos.', 422)
    }
    const value = raw as Record<string, unknown>
    const weekday = Number(value.weekday)
    const isOpen = value.isOpen === true
    const openTime = isOpen && typeof value.openTime === 'string' ? value.openTime.trim() : null
    const closeTime = isOpen && typeof value.closeTime === 'string' ? value.closeTime.trim() : null

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new AdminBusinessError('O dia da semana informado é inválido.', 422)
    }
    if (isOpen) {
      if (!openTime || !closeTime || !isValidTime(openTime) || !isValidTime(closeTime)) {
        throw new AdminBusinessError('Informe abertura e fechamento para os dias ativos.', 422)
      }
      const [openHour, openMinute] = openTime.split(':').map(Number)
      const [closeHour, closeMinute] = closeTime.split(':').map(Number)
      const openTotal = openHour * 60 + openMinute
      const closeTotal = closeHour * 60 + closeMinute
      if (openMinute % 30 !== 0 || closeMinute % 30 !== 0 || openTotal >= closeTotal) {
        throw new AdminBusinessError('Use intervalos de 30 minutos e feche após o horário de abertura.', 422)
      }
    }

    return { weekday, isOpen, openTime, closeTime }
  })

  if (new Set(hours.map((hour) => hour.weekday)).size !== 7) {
    throw new AdminBusinessError('Cada dia da semana deve aparecer uma única vez.', 422)
  }
  return hours.sort((left, right) => left.weekday - right.weekday)
}

export async function updateAdminBusinessSettings(body: Record<string, unknown>) {
  await requireAdminAccess()
  const settings = validateSettings(body)

  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE business_settings
     SET name = ?, street = ?, district = ?, city = ?, state = ?, postal_code = ?,
       phone = ?, email = ?, latitude = ?, longitude = ?, parking_info = ?, transit_info = ?, cnpj = ?
     WHERE id = 1`,
    [
      settings.name,
      settings.street,
      settings.district,
      settings.city,
      settings.state,
      settings.postalCode,
      settings.phone,
      settings.email,
      settings.latitude,
      settings.longitude,
      settings.parkingInfo,
      settings.transitInfo,
      settings.cnpj,
    ],
  )
  if (result.affectedRows === 0) throw new AdminBusinessError('Configuração não encontrada.', 404)
  return settings
}

export async function updateAdminBusinessHours(body: Record<string, unknown>) {
  await requireAdminAccess()
  const hours = validateHours(body)

  await withTransaction(async (connection) => {
    const [existing] = await connection.execute<WeekdayRow[]>(
      'SELECT weekday FROM business_hours ORDER BY weekday FOR UPDATE',
    )
    if (existing.length !== 7) throw new AdminBusinessError('Horários não encontrados.', 404)

    for (const hour of hours) {
      await connection.execute<ResultSetHeader>(
        `UPDATE business_hours
         SET is_open = ?, open_time = ?, close_time = ?
         WHERE weekday = ?`,
        [
          hour.isOpen,
          hour.openTime ? `${hour.openTime}:00` : null,
          hour.closeTime ? `${hour.closeTime}:00` : null,
          hour.weekday,
        ],
      )
    }
  })

  return hours
}
