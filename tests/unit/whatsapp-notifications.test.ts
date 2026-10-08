import { describe, expect, it } from 'vitest'
import {
  getAppointmentInstantInSaoPaulo,
  getWhatsAppRetryDelaySeconds,
} from '@/lib/whatsapp-notifications'

describe('agendamento dos avisos do WhatsApp', () => {
  it('converte o horário civil de São Paulo para o instante UTC correto', () => {
    expect(getAppointmentInstantInSaoPaulo('2026-10-08', '14:30:00').toISOString()).toBe(
      '2026-10-08T17:30:00.000Z',
    )
  })

  it('aplica espera exponencial com limite de uma hora', () => {
    expect([1, 2, 3, 4, 5].map(getWhatsAppRetryDelaySeconds)).toEqual([
      60, 300, 1_500, 3_600, 3_600,
    ])
  })
})
