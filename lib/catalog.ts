import 'server-only'

import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'
import type { Barber, Service } from '@/lib/types'

interface ServiceRow extends RowDataPacket {
  id: string
  name: string
  description: string
  duration_minutes: number
  price: number
  category: Service['category']
}

interface BarberRow extends RowDataPacket {
  id: string
  name: string
  specialty: string
  rating: number
  review_count: number
  bio: string
  photo_url: string
}

export async function getServices() {
  const [rows] = await getPool().execute<ServiceRow[]>(
    `SELECT id, name, description, duration_minutes, price, category
     FROM services
     WHERE is_active = TRUE
     ORDER BY FIELD(category, 'cortes', 'barba', 'combos', 'acabamentos'), name`,
  )

  return rows.map<Service>((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    price: row.price,
    category: row.category,
  }))
}

export async function getBarbers() {
  const [rows] = await getPool().execute<BarberRow[]>(
    `SELECT id, name, specialty, rating, review_count, bio, photo_url
     FROM barbers
     WHERE is_active = TRUE
     ORDER BY name`,
  )

  return rows.map<Barber>((row) => ({
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    rating: row.rating,
    reviewCount: row.review_count,
    bio: row.bio,
    photoUrl: row.photo_url,
  }))
}
