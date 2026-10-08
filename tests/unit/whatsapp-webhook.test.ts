import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { executeMock, getPoolMock } = vi.hoisted(() => {
  const execute = vi.fn()
  return {
    executeMock: execute,
    getPoolMock: vi.fn(() => ({ execute })),
  }
})

vi.mock('@/lib/db', () => ({ getPool: getPoolMock }))

import { GET, POST } from '@/app/api/webhooks/whatsapp/route'
import {
  extractWhatsAppWebhookStatusEvents,
  WHATSAPP_WEBHOOK_MAX_BODY_BYTES,
  WhatsAppWebhookPayloadError,
} from '@/lib/whatsapp-webhook'

const environmentKeys = [
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
] as const
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>

const verifyToken = 'verify-token-com-mais-de-trinta-e-dois-caracteres'
const appSecret = 'app-secret-com-mais-de-trinta-e-dois-caracteres'

function signatureFor(rawBody: string | Uint8Array) {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
}

function statusPayload(
  statuses: unknown[],
  overrides: Record<string, unknown> = {},
) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '123456789',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '123456789' },
              statuses,
            },
          },
        ],
      },
    ],
    ...overrides,
  }
}

function signedPost(body: string) {
  return new Request('http://localhost/api/webhooks/whatsapp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signatureFor(body),
    },
    body,
  })
}

describe('webhook oficial do WhatsApp', () => {
  beforeEach(() => {
    for (const key of environmentKeys) delete process.env[key]
    executeMock.mockResolvedValue([{ affectedRows: 1 }, undefined])
  })

  afterEach(() => {
    vi.clearAllMocks()
    for (const key of environmentKeys) {
      const originalValue = originalEnvironment[key]
      if (originalValue === undefined) delete process.env[key]
      else process.env[key] = originalValue
    }
  })

  it('devolve o challenge em texto somente para um token de verificação válido', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = verifyToken
    const request = new Request(
      `http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=1234567890`,
    )

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    expect(await response.text()).toBe('1234567890')
  })

  it('recusa a verificação quando o modo ou token não corresponde', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = verifyToken
    const request = new Request(
      'http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-incorreto&hub.challenge=123',
    )

    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it.each([undefined, 'curto'] as const)(
    'devolve 503 quando o token de verificação está ausente ou curto (%s)',
    async (value) => {
      if (value !== undefined) process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = value
      const request = new Request(
        'http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=qualquer&hub.challenge=123',
      )

      const response = await GET(request)

      expect(response.status).toBe(503)
    },
  )

  it('devolve 503 antes de ler o POST quando o app secret não foi configurado com segurança', async () => {
    process.env.WHATSAPP_APP_SECRET = 'curto'
    const response = await POST(
      new Request('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        body: '{',
      }),
    )

    expect(response.status).toBe(503)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('valida a assinatura do corpo bruto antes de tentar interpretar o JSON', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const response = await POST(
      new Request('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}` },
        body: '{json-malformado',
      }),
    )

    expect(response.status).toBe(401)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('devolve 400 para JSON malformado que possui assinatura válida', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const response = await POST(signedPost('{json-malformado'))

    expect(response.status).toBe(400)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('limita o corpo antes de armazená-lo ou processá-lo', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const response = await POST(
      new Request('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Length': String(WHATSAPP_WEBHOOK_MAX_BODY_BYTES + 1),
          'X-Hub-Signature-256': `sha256=${'0'.repeat(64)}`,
        },
        body: '{}',
      }),
    )

    expect(response.status).toBe(413)
    expect(executeMock).not.toHaveBeenCalled()
  })

  it('responde 200 para payload assinado irrelevante sem abrir o banco', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const body = JSON.stringify({ object: 'page', entry: [] })

    const response = await POST(signedPost(body))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true })
    expect(getPoolMock).not.toHaveBeenCalled()
  })

  it('extrai somente statuses suportados e converte o timestamp Unix', () => {
    const events = extractWhatsAppWebhookStatusEvents(
      statusPayload([
        { id: 'wamid.sent-12345678', status: 'sent', timestamp: '1791234567' },
        { id: 'wamid.delivered-1234', status: 'delivered', timestamp: 1791234568 },
        { id: 'wamid.read-123456789', status: 'read', timestamp: '1791234569' },
        { id: 'wamid.ignored-12345', status: 'accepted', timestamp: '1791234570' },
        { id: 'id-invalido', status: 'failed', timestamp: '1791234571' },
      ]),
    )

    expect(events.map(({ status }) => status)).toEqual(['sent', 'delivered', 'read'])
    expect(events[0].providerStatusAt).toEqual(new Date(1_791_234_567_000))
    expect(events.every(({ lastError }) => lastError === null)).toBe(true)
  })

  it('atualiza por provider_message_id com proteção temporal e ranking no próprio SQL', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const body = JSON.stringify(
      statusPayload([
        { id: 'wamid.delivered-1234', status: 'delivered', timestamp: '1791234567' },
        { id: 'wamid.read-123456789', status: 'read', timestamp: '1791234567' },
      ]),
    )

    const response = await POST(signedPost(body))

    expect(response.status).toBe(200)
    expect(executeMock).toHaveBeenCalledTimes(2)

    const [sql, deliveredParameters] = executeMock.mock.calls[0] as [string, unknown[]]
    expect(sql).toContain('UPDATE whatsapp_notifications')
    expect(sql).toContain('provider_message_id = ?')
    expect(sql).toContain('provider_status_at < ?')
    expect(sql).toContain('provider_status_at = ?')
    expect(sql).toContain('AND ? >= CASE status')
    expect(sql).toContain("WHEN 'accepted' THEN 0")
    expect(sql).toContain("WHEN 'delivered' THEN 3")
    expect(sql).toContain("WHEN 'read' THEN 4")
    expect(deliveredParameters).toEqual([
      'delivered',
      new Date(1_791_234_567_000),
      null,
      'wamid.delivered-1234',
      new Date(1_791_234_567_000),
      new Date(1_791_234_567_000),
      3,
    ])
    expect(executeMock.mock.calls[1][1]).toEqual([
      'read',
      new Date(1_791_234_567_000),
      null,
      'wamid.read-123456789',
      new Date(1_791_234_567_000),
      new Date(1_791_234_567_000),
      4,
    ])
  })

  it('armazena uma descrição de falha limitada e remove credenciais e telefone', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const sensitiveToken = 'token-super-secreto-com-mais-de-32-caracteres'
    const body = JSON.stringify(
      statusPayload([
        {
          id: 'wamid.failed-12345678',
          status: 'failed',
          timestamp: '1791234567',
          errors: [
            {
              code: 131047,
              title: `access_token=${sensitiveToken} telefone +55 (11) 99999-9999`,
            },
          ],
        },
      ]),
    )

    const response = await POST(signedPost(body))

    expect(response.status).toBe(200)
    const parameters = executeMock.mock.calls[0][1] as unknown[]
    expect(parameters[0]).toBe('failed')
    expect(parameters[2]).toContain('código 131047')
    expect(parameters[2]).toContain('[redigido]')
    expect(parameters[2]).not.toContain(sensitiveToken)
    expect(parameters[2]).not.toContain('99999-9999')
    expect(String(parameters[2]).length).toBeLessThanOrEqual(500)
  })

  it('confirma com 200 mesmo quando o provider_message_id não existe localmente', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    executeMock.mockResolvedValueOnce([{ affectedRows: 0 }, undefined])
    const body = JSON.stringify(
      statusPayload([
        { id: 'wamid.unknown-123456', status: 'sent', timestamp: '1791234567' },
      ]),
    )

    const response = await POST(signedPost(body))

    expect(response.status).toBe(200)
    expect(executeMock).toHaveBeenCalledOnce()
  })

  it('rejeita payloads com coleções além do limite de segurança', () => {
    expect(() =>
      extractWhatsAppWebhookStatusEvents({
        object: 'whatsapp_business_account',
        entry: Array.from({ length: 101 }, () => ({})),
      }),
    ).toThrow(WhatsAppWebhookPayloadError)
  })
})
