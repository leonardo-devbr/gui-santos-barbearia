import type { Service } from '@/lib/types'

// Dados mockados. Em uma futura integração, este arquivo será substituído
// por uma chamada a GET /api/services.
export const services: Service[] = [
  {
    id: 'corte',
    name: 'Corte',
    description: 'Degradê, social ou corte tradicional.',
    durationMinutes: 45,
    price: 40,
    category: 'cortes',
  },
  {
    id: 'barba',
    name: 'Barba',
    description: 'Modelagem completa com navalha e toalha quente.',
    durationMinutes: 30,
    price: 35,
    category: 'barba',
  },
  {
    id: 'corte-barba',
    name: 'Corte + Barba',
    description: 'O combo completo para um visual impecável.',
    durationMinutes: 75,
    price: 65,
    category: 'combos',
  },
  {
    id: 'sobrancelha',
    name: 'Sobrancelha',
    description: 'Alinhamento e limpeza com navalha.',
    durationMinutes: 15,
    price: 15,
    category: 'acabamentos',
  },
  {
    id: 'acabamento',
    name: 'Acabamento',
    description: 'Retoque de contorno e nuca entre cortes.',
    durationMinutes: 20,
    price: 20,
    category: 'acabamentos',
  },
  {
    id: 'corte-infantil',
    name: 'Corte Infantil',
    description: 'Corte especial para os pequenos, com paciência e cuidado.',
    durationMinutes: 40,
    price: 35,
    category: 'cortes',
  },
]

export function getServiceById(id: string) {
  return services.find((s) => s.id === id)
}

export const categoryLabels: Record<Service['category'], string> = {
  cortes: 'Cortes',
  barba: 'Barba',
  combos: 'Combos',
  acabamentos: 'Acabamentos',
}
