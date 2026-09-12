import type { Review } from '@/lib/types'

export const reviews: Review[] = [
  {
    id: 'rev-1',
    customerName: 'Marcelo T.',
    rating: 5,
    comment: 'Ambiente impecável e atendimento no mais alto nível. Saí de lá renovado.',
    date: '2026-07-20',
  },
  {
    id: 'rev-2',
    customerName: 'Diego A.',
    rating: 5,
    comment: 'O Guilherme entende exatamente o que eu quero. Melhor barbearia da região.',
    date: '2026-07-05',
  },
  {
    id: 'rev-3',
    customerName: 'Felipe R.',
    rating: 4,
    comment: 'Ótimo corte e barba. Ambiente premium, vale cada centavo.',
    date: '2026-06-18',
  },
]
