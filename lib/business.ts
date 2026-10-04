import 'server-only'

import { cache } from 'react'
import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'
import type { BusinessConfiguration, BusinessHour, BusinessSettings } from '@/lib/types'

interface BusinessSettingsRow extends RowDataPacket {
  name: string
  street: string
  district: string
  city: string
  state: string
  postal_code: string
  phone: string
  email: string
  latitude: number
  longitude: number
  parking_info: string
  transit_info: string
  cnpj: string
}

interface BusinessHourRow extends RowDataPacket {
  weekday: number
  is_open: number | boolean
  open_time: string | null
  close_time: string | null
}

function mapSettings(row: BusinessSettingsRow): BusinessSettings {
  return {
    name: row.name,
    street: row.street,
    district: row.district,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    phone: row.phone,
    email: row.email,
    latitude: row.latitude,
    longitude: row.longitude,
    parkingInfo: row.parking_info,
    transitInfo: row.transit_info,
    cnpj: row.cnpj,
  }
}

function mapHour(row: BusinessHourRow): BusinessHour {
  return {
    weekday: row.weekday,
    isOpen: Boolean(row.is_open),
    openTime: row.open_time?.slice(0, 5) ?? null,
    closeTime: row.close_time?.slice(0, 5) ?? null,
  }
}

export const getBusinessConfiguration = cache(async (): Promise<BusinessConfiguration> => {
  const pool = getPool()
  const [[settingsRows], [hourRows]] = await Promise.all([
    pool.execute<BusinessSettingsRow[]>(
      `SELECT name, street, district, city, state, postal_code, phone, email,
        latitude, longitude, parking_info, transit_info, cnpj
       FROM business_settings
       WHERE id = 1
       LIMIT 1`,
    ),
    pool.execute<BusinessHourRow[]>(
      `SELECT weekday, is_open, open_time, close_time
       FROM business_hours
       ORDER BY FIELD(weekday, 1, 2, 3, 4, 5, 6, 0)`,
    ),
  ])

  if (!settingsRows[0] || hourRows.length !== 7) {
    throw new Error('As configurações da barbearia ainda não foram preparadas no banco.')
  }

  return {
    settings: mapSettings(settingsRows[0]),
    hours: hourRows.map(mapHour),
  }
})
