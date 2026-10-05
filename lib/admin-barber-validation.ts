import { normalizePhone } from '@/lib/validation'

export type AdminBarberFormField =
  | 'name'
  | 'phone'
  | 'specialty'
  | 'bio'
  | 'rating'
  | 'reviewCount'
  | 'photo'

export type AdminBarberFormErrors = Partial<Record<AdminBarberFormField, string>>

export interface AdminBarberFormValues {
  name: string
  phone: string
  specialty: string
  bio: string
  rating: string | number
  reviewCount: string | number
}

export function validateAdminBarberForm(values: AdminBarberFormValues) {
  const name = values.name.trim().replace(/\s+/g, ' ')
  const phoneDigits = values.phone.replace(/\D/g, '')
  const phone = normalizePhone(values.phone)
  const specialty = values.specialty.trim().replace(/\s+/g, ' ')
  const bio = values.bio.trim().replace(/\s+/g, ' ')
  const rawRating = String(values.rating).trim()
  const rawReviewCount = String(values.reviewCount).trim()
  const rating = rawRating ? Number(rawRating) : Number.NaN
  const reviewCount = rawReviewCount ? Number(rawReviewCount) : Number.NaN
  const errors: AdminBarberFormErrors = {}

  if (name.length < 2 || name.length > 100) {
    errors.name = 'O nome deve ter entre 2 e 100 caracteres.'
  }
  if (phoneDigits.length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
    errors.phone = 'Informe um telefone com DDD ou deixe o campo em branco.'
  }
  if (specialty.length < 3 || specialty.length > 160) {
    errors.specialty = 'A especialidade deve ter entre 3 e 160 caracteres.'
  }
  if (bio.length < 3 || bio.length > 500) {
    errors.bio = 'A apresentação deve ter entre 3 e 500 caracteres.'
  }
  if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
    errors.rating = 'A avaliação deve estar entre 0 e 5.'
  }
  if (!Number.isInteger(reviewCount) || reviewCount < 0 || reviewCount > 1_000_000) {
    errors.reviewCount = 'Informe uma quantidade válida de avaliações.'
  }

  return {
    data: {
      name,
      phone,
      specialty,
      bio,
      rating: Math.round(rating * 10) / 10,
      reviewCount,
    },
    errors,
  }
}
