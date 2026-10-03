import { describe, expect, it } from 'vitest'
import {
  filterAdminAppointments,
  getAgendaPeriod,
  shiftAgendaReference,
} from '@/lib/admin-agenda'
import type { AdminAppointment } from '@/lib/types'

function appointment(
  id: string,
  overrides: Partial<AdminAppointment> = {},
): AdminAppointment {
  return {
    id,
    serviceId: 'corte',
    barberId: 'guilherme',
    customerId: 'cliente-a',
    serviceName: 'Corte tradicional',
    barberName: 'Guilherme',
    customerName: 'Cliente A',
    customerPhone: '11999999999',
    customerEmail: 'cliente-a@example.test',
    date: '2026-09-27',
    time: '09:00',
    status: 'confirmado',
    price: 40,
    durationMinutes: 45,
    canComplete: false,
    canCancel: true,
    ...overrides,
  }
}

describe('períodos da agenda administrativa', () => {
  it('calcula o dia selecionado', () => {
    expect(getAgendaPeriod('2026-09-27', 'day')).toEqual({
      startDate: '2026-09-27',
      endDate: '2026-09-27',
    })
  })

  it('calcula a semana brasileira de segunda a domingo', () => {
    expect(getAgendaPeriod('2026-09-27', 'week')).toEqual({
      startDate: '2026-09-21',
      endDate: '2026-09-27',
    })
  })

  it('respeita o último dia do mês, inclusive em ano bissexto', () => {
    expect(getAgendaPeriod('2024-02-10', 'month')).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29',
    })
  })

  it('navega entre meses e anos sem carregar o dia inválido', () => {
    expect(shiftAgendaReference('2026-12-31', 'month', 1)).toBe('2027-01-01')
    expect(shiftAgendaReference('2026-01-31', 'month', -1)).toBe('2025-12-01')
  })
})

describe('filtros da agenda administrativa', () => {
  const appointments = [
    appointment('primeiro'),
    appointment('segundo', {
      serviceId: 'barba',
      serviceName: 'Barba',
      customerId: 'cliente-b',
      customerName: 'Cliente B',
      customerEmail: 'cliente-b@example.test',
      time: '15:30',
    }),
  ]

  it('combina serviço, cliente e intervalo em horário de 24 horas', () => {
    expect(
      filterAdminAppointments(appointments, {
        serviceId: 'barba',
        customerId: 'cliente-b',
        startTime: '12:00',
        endTime: '18:00',
      }).map(({ id }) => id),
    ).toEqual(['segundo'])
  })

  it('mantém todos quando os filtros estão vazios', () => {
    expect(
      filterAdminAppointments(appointments, {
        serviceId: '',
        customerId: '',
        startTime: '',
        endTime: '',
      }),
    ).toHaveLength(2)
  })
})
