import { beforeEach, describe, expect, it, vi } from 'vitest'

const { executeMock, getPoolMock } = vi.hoisted(() => {
  const execute = vi.fn()
  return {
    executeMock: execute,
    getPoolMock: vi.fn(() => ({ execute })),
  }
})

vi.mock('@/lib/db', () => ({ getPool: getPoolMock }))

import {
  formatAdminWhatsAppDateTime,
  getAdminWhatsAppNotifications,
  getSafeAdminWhatsAppError,
  parseAdminWhatsAppFilters,
} from '@/lib/admin-whatsapp-notifications'

describe('auditoria administrativa dos avisos do WhatsApp', () => {
  beforeEach(() => {
    executeMock.mockReset()
  })

  it('aceita somente filtros conhecidos e valores únicos', () => {
    expect(
      parseAdminWhatsAppFilters({
        status: 'delivered',
        event: 'reminder_2h',
      }),
    ).toEqual({ status: 'delivered', event: 'reminder_2h' })

    expect(
      parseAdminWhatsAppFilters({
        status: "pending' OR 1=1 --",
        event: ['appointment_created', 'appointment_cancelled'],
      }),
    ).toEqual({})
  })

  it('consulta no máximo 100 registros com parâmetros e nunca devolve o telefone completo', async () => {
    executeMock.mockResolvedValueOnce([
      [
        {
          id: 'notification-id',
          event: 'appointment_created',
          audience: 'customer',
          recipient_name: 'Cliente Teste',
          recipient_phone: '15999991111',
          details_snapshot: JSON.stringify({
            customerName: 'Cliente Teste',
            serviceName: 'Corte',
            barberName: 'Matheus',
            dateLabel: '8 de outubro de 2026',
            time: '15:30',
          }),
          status: 'pending',
          attempts: 2,
          scheduled_for: '2026-10-08 18:30:00',
          created_at: '2026-10-08 12:00:00',
          last_error: 'token-secreto-que-nao-pode-aparecer',
        },
      ],
      undefined,
    ])

    const notifications = await getAdminWhatsAppNotifications({
      status: 'pending',
      event: 'appointment_created',
    })
    const [sql, parameters] = executeMock.mock.calls[0]

    expect(sql).toContain('FROM whatsapp_notifications')
    expect(sql).toContain('WHERE status = ? AND event = ?')
    expect(sql).toContain('LIMIT 100')
    expect(parameters).toEqual(['pending', 'appointment_created'])
    expect(notifications).toHaveLength(1)
    expect(notifications[0]).toMatchObject({
      recipientName: 'Cliente Teste',
      maskedRecipientPhone: '••••1111',
      safeError: 'O envio falhou temporariamente e aguarda uma nova tentativa.',
      details: {
        customerName: 'Cliente Teste',
        serviceName: 'Corte',
        barberName: 'Matheus',
        dateLabel: '8 de outubro de 2026',
        time: '15:30',
      },
    })
    expect(JSON.stringify(notifications[0])).not.toContain('15999991111')
    expect(JSON.stringify(notifications[0])).not.toContain('token-secreto')
  })

  it('traduz datas UTC para o horário de São Paulo e protege detalhes técnicos', () => {
    expect(formatAdminWhatsAppDateTime('2026-10-08 15:30:00')).toContain('08/10/2026')
    expect(formatAdminWhatsAppDateTime('2026-10-08 15:30:00')).toContain('12:30')
    expect(formatAdminWhatsAppDateTime('inválida')).toBe('Data indisponível')
    expect(getSafeAdminWhatsAppError('failed', 5, true)).not.toContain('token')
    expect(getSafeAdminWhatsAppError('delivered', 1, true)).toBeNull()
  })
})
