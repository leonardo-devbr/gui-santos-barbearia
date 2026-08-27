import type { CustomerProfile, Review } from '@/lib/types'

// Dados mockados. Em uma futura integração, este arquivo será substituído
// por uma chamada a GET /api/customers/me.
export const currentCustomer: CustomerProfile = {
  id: 'cliente-001',
  name: 'João Pedro',
  phone: '(11) 98765-4321',
  email: 'joao.pedro@email.com',
  birthDate: '1994-03-12',
  photoUrl: '/placeholder-user.jpg',
  preferredCut: 'Degradê médio',
  beardStyle: 'Barba média',
  notes: 'Prefere acabamento natural.',
  loyaltyPoints: 320,
}

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

export const barbershopInfo = {
  name: 'Gui Santos Barbearia',
  address: 'Rua Augusta, 1200 — Jardins, São Paulo — SP',
  phone: '(15) 99130-7316',
  whatsapp: '(15) 99130-7316',
  hours: [
    { day: 'Segunda a Sexta', time: '09:00 — 20:00' },
    { day: 'Sábado', time: '09:00 — 18:00' },
    { day: 'Domingo', time: 'Fechado' },
  ],
  mapsUrl: 'https://maps.google.com/?q=Rua+Augusta+1200+Sao+Paulo',
}
