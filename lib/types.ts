// Tipos centrais do domínio. Organizados para facilitar a futura substituição
// por respostas da API conectada ao MySQL.

export interface Service {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number
  category: 'cortes' | 'barba' | 'combos' | 'acabamentos'
}

export interface Barber {
  id: string
  name: string
  specialty: string
  rating: number
  reviewCount: number
  bio: string
  photoUrl: string
}

export type AppointmentStatus = 'confirmado' | 'pendente' | 'concluido' | 'cancelado'

export interface Appointment {
  id: string
  serviceId: string
  barberId: string
  serviceName?: string
  barberName?: string
  date: string // ISO date, e.g. 2026-08-22
  time: string // HH:mm
  status: AppointmentStatus
  price: number
  durationMinutes: number
}

export const serviceCategoryLabels: Record<Service['category'], string> = {
  cortes: 'Cortes',
  barba: 'Barba',
  combos: 'Combos',
  acabamentos: 'Acabamentos',
}

export interface TimeSlot {
  time: string // HH:mm
  available: boolean
}

export interface Review {
  id: string
  customerName: string
  rating: number
  comment: string
  date: string
}

export interface Reward {
  id: string
  points: number
  title: string
  description: string
}

export interface LoyaltyTier {
  name: string
  minPoints: number
}

export interface CustomerProfile {
  id: string
  name: string
  phone: string
  email: string
  birthDate: string
  photoUrl: string
  preferredCut: string
  beardStyle: string
  notes: string
  loyaltyPoints: number
}
