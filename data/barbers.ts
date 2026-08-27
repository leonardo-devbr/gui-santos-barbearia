import type { Barber } from '@/lib/types'

// Dados mockados. Em uma futura integração, este arquivo será substituído
// por uma chamada a GET /api/barbers.
export const barbers: Barber[] = [
  {
    id: 'guilherme',
    name: 'Matheus Guilherme',
    specialty: 'Especialista em degradê e corte masculino',
    rating: 4.9,
    reviewCount: 218,
    bio: 'Fundador da Gui Santos Barbearia, com mais de 12 anos de experiência em cortes masculinos de alto padrão.',
    photoUrl: '/images/WhatsApp Image 2026-08-26 at 13.09.49.jpeg',
  },
  {
    id: 'vitor',
    name: 'Vitor',
    specialty: 'Especialista em degradê e corte masculino',
    rating: 4.9,
    reviewCount: 134,
    bio: 'Especialista em degradê e corte masculino, com atenção aos detalhes para um resultado preciso.',
    photoUrl: '/images/b123ae60-0e4a-479b-aba0-a533ed6f4a98.jpg',
  },
]

export function getBarberById(id: string) {
  return barbers.find((barber) => barber.id === id)
}
