import 'server-only'

import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'
import { getBarberPhotoUrl } from '@/lib/barber-photo'
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
  phone: string
  specialty: string
  rating: number
  review_count: number
  bio: string
  photo_url: string
  has_uploaded_photo: number | boolean
  photo_position_x: number
  photo_position_y: number
  photo_revision: number
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
    `SELECT id, name, phone, specialty, rating, review_count, bio, photo_url,
       photo_data IS NOT NULL AS has_uploaded_photo,
       photo_position_x, photo_position_y, photo_revision
     FROM barbers
     WHERE is_active = TRUE
     ORDER BY name`,
  )

  return rows.map<Barber>((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    specialty: row.specialty,
    rating: row.rating,
    reviewCount: row.review_count,
    bio: row.bio,
    photoUrl: getBarberPhotoUrl(
      row.id,
      row.photo_url,
      Boolean(row.has_uploaded_photo),
      row.photo_revision,
    ),
    photoPositionX: row.photo_position_x,
    photoPositionY: row.photo_position_y,
  }))
}
