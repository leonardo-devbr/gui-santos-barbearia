import { beforeEach, describe, expect, it, vi } from 'vitest'

const { authMock, rateLimitMock, clientIdentifierMock, processMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  rateLimitMock: vi.fn(),
  clientIdentifierMock: vi.fn(() => '127.0.0.1'),
  processMock: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({ getAuthenticatedStaff: authMock }))
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimits: rateLimitMock,
  getClientIdentifier: clientIdentifierMock,
  rateLimitResponse: (retryAfter: number) =>
    Response.json(
      { message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    ),
}))
vi.mock('@/lib/whatsapp-notifications', () => ({
  processWhatsAppNotifications: processMock,
}))

import { POST } from '@/app/api/admin/notificacoes/processar/route'

const request = () =>
  new Request('http://localhost/api/admin/notificacoes/processar', { method: 'POST' })

describe('processamento manual dos avisos do WhatsApp', () => {
  beforeEach(() => {
    authMock.mockReset()
    rateLimitMock.mockReset()
    processMock.mockReset()
    clientIdentifierMock.mockClear()
    rateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 })
  })

  it('exige uma sessão autenticada', async () => {
    authMock.mockResolvedValue(null)

    const response = await POST(request())

    expect(response.status).toBe(401)
    expect(processMock).not.toHaveBeenCalled()
  })

  it('recusa o processamento para o acesso de barbeiro', async () => {
    authMock.mockResolvedValue({
      id: 'staff-barber',
      name: 'Barbeiro',
      email: 'barbeiro@example.com',
      role: 'barber',
      barberId: 'barber-id',
    })

    const response = await POST(request())

    expect(response.status).toBe(403)
    expect(rateLimitMock).not.toHaveBeenCalled()
    expect(processMock).not.toHaveBeenCalled()
  })

  it('aplica limite por administrador e IP antes de processar', async () => {
    authMock.mockResolvedValue({
      id: 'admin-id',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      barberId: null,
    })
    rateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 42 })

    const response = await POST(request())

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(rateLimitMock).toHaveBeenCalledWith([
      expect.objectContaining({ identifier: 'admin-id', limit: 5 }),
      expect.objectContaining({ identifier: '127.0.0.1', limit: 15 }),
    ])
    expect(processMock).not.toHaveBeenCalled()
  })

  it('processa somente com acesso administrativo válido', async () => {
    authMock.mockResolvedValue({
      id: 'admin-id',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      barberId: null,
    })
    processMock.mockResolvedValue({
      recovered: 0,
      purged: 0,
      processed: 3,
      previewed: 3,
      accepted: 0,
      skipped: 0,
      retryScheduled: 0,
      failed: 0,
      superseded: 0,
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(processMock).toHaveBeenCalledOnce()
    await expect(response.json()).resolves.toMatchObject({
      message: '3 aviso(s) processado(s). A lista foi atualizada.',
      result: { processed: 3, previewed: 3 },
    })
  })

  it('informa sem descartar a fila quando o provedor está pausado', async () => {
    authMock.mockResolvedValue({
      id: 'admin-id',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      barberId: null,
    })
    processMock.mockResolvedValue({
      paused: true,
      recovered: 0,
      purged: 0,
      processed: 0,
      previewed: 0,
      accepted: 0,
      skipped: 0,
      retryScheduled: 0,
      failed: 0,
      superseded: 0,
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      message: 'O envio está pausado. Configure o provedor do WhatsApp para processar a fila.',
      result: { paused: true, processed: 0 },
    })
  })
})
