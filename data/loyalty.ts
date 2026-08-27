import type { LoyaltyTier, Reward } from '@/lib/types'

// Dados mockados. Em uma futura integração, este arquivo será substituído
// por uma chamada a GET /api/loyalty.
export const loyaltyTiers: LoyaltyTier[] = [
  { name: 'Bronze', minPoints: 0 },
  { name: 'Prata', minPoints: 500 },
  { name: 'Ouro', minPoints: 1000 },
  { name: 'Platina', minPoints: 2000 },
]

export const rewards: Reward[] = [
  { id: 'r1', points: 100, title: 'R$ 10 OFF', description: 'Desconto em qualquer serviço.' },
  { id: 'r2', points: 300, title: '10% OFF', description: 'Desconto em um combo completo.' },
  { id: 'r3', points: 500, title: 'Corte grátis', description: 'Um corte por conta da casa.' },
]

export const waysToEarnPoints = [
  'Agendando um atendimento',
  'Comparecendo ao horário',
  'Avaliando o atendimento',
  'Indicando um amigo',
  'Comprando produtos',
]

export function getCurrentTier(points: number): { current: LoyaltyTier; next: LoyaltyTier | null } {
  const sorted = [...loyaltyTiers].sort((a, b) => a.minPoints - b.minPoints)
  let current = sorted[0]
  let next: LoyaltyTier | null = null
  for (let i = 0; i < sorted.length; i++) {
    if (points >= sorted[i].minPoints) {
      current = sorted[i]
      next = sorted[i + 1] ?? null
    }
  }
  return { current, next }
}
