import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { executeMock, getPoolMock, withTransactionMock } = vi.hoisted(() => {
  const execute = vi.fn()
  return {
    executeMock: execute,
    getPoolMock: vi.fn(() => ({ execute })),
    withTransactionMock: vi.fn(
      async (work: (connection: { execute: typeof execute }) => Promise<unknown>) =>
        work({ execute }),
    ),
  }
})

vi.mock('@/lib/db', () => ({ getPool: getPoolMock, withTransaction: withTransactionMock }))

import { GET, POST } from '@/app/api/webhooks/whatsapp/route'
import {
  applyPendingWhatsAppWebhookEventsForMessage,
  applyPendingWhatsAppWebhookStatusEvents,
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
    executeMock.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id') && sql.includes('FROM whatsapp_notifications')) {
        return [[{ id: 'notification-id' }], undefined]
      }
      return [{ affectedRows: 1 }, undefined]
    })
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
        {
          id: 'wamid.sent-12345678',
          status: 'sent',
          timestamp: '1791234567',
          biz_opaque_callback_data: 'wn1:00000000-0000-4000-8000-000000000123:2',
        },
        { id: 'wamid.delivered-1234', status: 'delivered', timestamp: 1791234568 },
        { id: 'wamid.read-123456789', status: 'read', timestamp: '1791234569' },
        { id: 'wamid.ignored-12345', status: 'accepted', timestamp: '1791234570' },
        { id: 'id-invalido', status: 'failed', timestamp: '1791234571' },
      ]),
    )

    expect(events.map(({ status }) => status)).toEqual(['sent', 'delivered', 'read'])
    expect(events[0].providerStatusAt).toEqual(new Date(1_791_234_567_000))
    expect(events[0]).toMatchObject({
      notificationId: '00000000-0000-4000-8000-000000000123',
      notificationAttempt: 2,
    })
    expect(events[1]).toMatchObject({ notificationId: null, notificationAttempt: null })
    expect(events.every(({ lastError }) => lastError === null)).toBe(true)
  })

  it.each([
    'outro:00000000-0000-4000-8000-000000000123:1',
    'wn1:uuid-invalido:1',
    'wn1:00000000-0000-4000-8000-000000000123:0',
    'wn1:00000000-0000-4000-8000-000000000123:256',
    'x'.repeat(513),
  ])('ignora correlação opaca inválida sem descartar o status: %s', (callbackData) => {
    const [event] = extractWhatsAppWebhookStatusEvents(
      statusPayload([
        {
          id: 'wamid.invalid-callback-12345',
          status: 'sent',
          timestamp: '1791234567',
          biz_opaque_callback_data: callbackData,
        },
      ]),
    )

    expect(event).toMatchObject({
      providerMessageId: 'wamid.invalid-callback-12345',
      notificationId: null,
      notificationAttempt: null,
    })
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
    expect(executeMock).toHaveBeenCalledTimes(8)

    const [insertSql, insertParameters] = executeMock.mock.calls[0] as [string, unknown[]]
    expect(insertSql).toContain('INSERT IGNORE INTO whatsapp_webhook_status_events')
    expect(insertParameters[0]).toMatch(/^[a-f\d]{64}$/)
    expect(insertParameters.slice(1)).toEqual([
      'wamid.delivered-1234',
      null,
      null,
      'delivered',
      new Date(1_791_234_567_000),
      null,
    ])

    const [lockSql, lockParameters] = executeMock.mock.calls[1] as [string, unknown[]]
    expect(lockSql).toContain('FROM whatsapp_notifications')
    expect(lockSql).toContain('FOR UPDATE')
    expect(lockParameters).toEqual(['wamid.delivered-1234'])

    const [sql, deliveredParameters] = executeMock.mock.calls[2] as [string, unknown[]]
    expect(sql).toContain('UPDATE whatsapp_notifications')
    expect(sql).toContain(
      'provider_message_id = COALESCE(notifications.provider_message_id, ?)',
    )
    expect(sql).toContain('WHERE notifications.id = ?')
    expect(sql).toContain('OR ? > CASE notifications.status')
    expect(sql).toContain('? = CASE notifications.status')
    expect(sql).toContain('AND notifications.provider_status_at <= ?')
    expect(sql).toContain("WHEN 'accepted' THEN 0")
    expect(sql).toContain("WHEN 'delivered' THEN 3")
    expect(sql).toContain("WHEN 'read' THEN 4")
    expect(deliveredParameters).toEqual([
      insertParameters[0],
      'delivered',
      new Date(1_791_234_567_000),
      null,
      'wamid.delivered-1234',
      'notification-id',
      3,
      3,
      new Date(1_791_234_567_000),
    ])
    expect(executeMock.mock.calls[6][1]).toEqual([
      executeMock.mock.calls[4][1][0],
      'read',
      new Date(1_791_234_567_000),
      null,
      'wamid.read-123456789',
      'notification-id',
      4,
      4,
      new Date(1_791_234_567_000),
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
    const parameters = executeMock.mock.calls[2][1] as unknown[]
    expect(parameters[1]).toBe('failed')
    expect(parameters[3]).toContain('código 131047')
    expect(parameters[3]).toContain('[redigido]')
    expect(parameters[3]).not.toContain(sensitiveToken)
    expect(parameters[3]).not.toContain('99999-9999')
    expect(String(parameters[3]).length).toBeLessThanOrEqual(500)
  })

  it('confirma com 200 mesmo quando o provider_message_id não existe localmente', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    executeMock
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([[], undefined])
    const body = JSON.stringify(
      statusPayload([
        { id: 'wamid.unknown-123456', status: 'sent', timestamp: '1791234567' },
      ]),
    )

    const response = await POST(signedPost(body))

    expect(response.status).toBe(200)
    expect(executeMock).toHaveBeenCalledTimes(2)
    expect(executeMock.mock.calls[0][0]).toContain(
      'INSERT IGNORE INTO whatsapp_webhook_status_events',
    )
    expect(executeMock.mock.calls[1][0]).toContain('FOR UPDATE')
  })

  it('reaplica um status guardado quando o identificador da mensagem passa a existir', async () => {
    const providerStatusAt = '2026-10-09 12:34:56'
    executeMock
      .mockResolvedValueOnce([
        [
          {
            event_key: 'a'.repeat(64),
            provider_message_id: 'wamid.race-12345678',
            notification_id: null,
            notification_attempt: null,
            status: 'sent',
            provider_status_at: providerStatusAt,
            last_error: null,
          },
        ],
        undefined,
      ])
      .mockResolvedValueOnce([[{ id: 'notification-race' }], undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])

    await expect(
      applyPendingWhatsAppWebhookEventsForMessage('wamid.race-12345678'),
    ).resolves.toBe(1)

    expect(executeMock).toHaveBeenCalledTimes(4)
    expect(executeMock.mock.calls[0][0]).toContain(
      'FROM whatsapp_webhook_status_events AS status_events',
    )
    expect(executeMock.mock.calls[0][1]).toEqual([
      'wamid.race-12345678',
    ])
    expect(executeMock.mock.calls[1][1]).toEqual(['wamid.race-12345678'])
    expect(executeMock.mock.calls[2][1]).toEqual([
      'a'.repeat(64),
      'sent',
      providerStatusAt,
      null,
      'wamid.race-12345678',
      'notification-race',
      1,
      1,
      providerStatusAt,
    ])
    expect(executeMock.mock.calls[3][0]).toContain('SET status_events.applied_at')
  })

  it('marca como aplicado um evento antigo sem regredir o status atual', async () => {
    executeMock
      .mockResolvedValueOnce([
        [
          {
            event_key: 'b'.repeat(64),
            provider_message_id: 'wamid.stale-1234567',
            notification_id: null,
            notification_attempt: null,
            status: 'sent',
            provider_status_at: '2026-10-09 10:00:00',
            last_error: null,
          },
        ],
        undefined,
      ])
      .mockResolvedValueOnce([[{ id: 'notification-stale' }], undefined])
      .mockResolvedValueOnce([{ affectedRows: 0 }, undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])

    await expect(applyPendingWhatsAppWebhookStatusEvents()).resolves.toBe(0)

    expect(executeMock.mock.calls[0][0]).not.toContain(
      'AND status_events.provider_message_id = ?',
    )
    expect(executeMock.mock.calls[0][1]).toEqual([])
    expect(executeMock.mock.calls[3][0]).toContain('SET status_events.applied_at')
  })

  it('correlaciona pelo identificador interno quando a resposta com wamid foi perdida', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const notificationId = '00000000-0000-4000-8000-000000000456'
    executeMock
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([[], undefined])
      .mockResolvedValueOnce([[{ id: notificationId }], undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
    const body = JSON.stringify(
      statusPayload([
        {
          id: 'wamid.correlated-12345',
          status: 'delivered',
          timestamp: '1791234567',
          biz_opaque_callback_data: `wn1:${notificationId}:1`,
        },
      ]),
    )

    expect((await POST(signedPost(body))).status).toBe(200)

    expect(executeMock).toHaveBeenCalledTimes(5)
    expect(executeMock.mock.calls[0][1].slice(1, 4)).toEqual([
      'wamid.correlated-12345',
      notificationId,
      1,
    ])
    expect(executeMock.mock.calls[2][0]).toContain('WHERE id = ? AND attempts >= ?')
    expect(executeMock.mock.calls[2][1]).toEqual([notificationId, 1])
    expect(executeMock.mock.calls[3][1].slice(1, 6)).toEqual([
      'delivered',
      new Date(1_791_234_567_000),
      null,
      'wamid.correlated-12345',
      notificationId,
    ])
  })

  it('ignora a falha tardia de uma tentativa anterior depois que outra já começou', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const notificationId = '00000000-0000-4000-8000-000000000654'
    executeMock
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
      .mockResolvedValueOnce([[], undefined])
      .mockResolvedValueOnce([
        [
          {
            id: notificationId,
            attempts: 2,
            provider_message_id: 'wamid.new-attempt-12345',
          },
        ],
        undefined,
      ])
      .mockResolvedValueOnce([{ affectedRows: 1 }, undefined])
    const body = JSON.stringify(
      statusPayload([
        {
          id: 'wamid.old-failed-12345',
          status: 'failed',
          timestamp: '1791234567',
          biz_opaque_callback_data: `wn1:${notificationId}:1`,
        },
      ]),
    )

    expect((await POST(signedPost(body))).status).toBe(200)

    expect(executeMock).toHaveBeenCalledTimes(4)
    expect(executeMock.mock.calls[3][0]).toContain(
      'UPDATE whatsapp_webhook_status_events',
    )
    expect(
      executeMock.mock.calls.some(([sql]) =>
        String(sql).includes('UPDATE whatsapp_notifications'),
      ),
    ).toBe(false)
  })

  it('gera a mesma chave idempotente ao receber novamente o mesmo evento', async () => {
    process.env.WHATSAPP_APP_SECRET = appSecret
    const body = JSON.stringify(
      statusPayload([
        { id: 'wamid.duplicate-12345', status: 'delivered', timestamp: '1791234567' },
      ]),
    )

    expect((await POST(signedPost(body))).status).toBe(200)
    const firstEventKey = executeMock.mock.calls[0][1][0]

    executeMock.mockClear()
    expect((await POST(signedPost(body))).status).toBe(200)
    const repeatedEventKey = executeMock.mock.calls[0][1][0]

    expect(repeatedEventKey).toBe(firstEventKey)
    expect(String(repeatedEventKey)).toMatch(/^[a-f\d]{64}$/)
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
