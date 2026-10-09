import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAppointmentWhatsAppTemplate,
  type AppointmentWhatsAppDetails,
  type AppointmentWhatsAppEvent,
  type WhatsAppRecipientAudience,
} from '@/lib/whatsapp-templates'
import {
  getWhatsAppDispatchState,
  maskWhatsAppNumber,
  normalizeBrazilianWhatsAppNumber,
  sendAppointmentWhatsApp,
  WhatsAppConfigurationError,
  WhatsAppDeliveryError,
} from '@/lib/whatsapp'

const environmentKeys = [
  'WHATSAPP_PROVIDER',
  'WHATSAPP_GRAPH_API_VERSION',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_TEMPLATE_NAME',
  'WHATSAPP_TEMPLATE_LANGUAGE',
  'WHATSAPP_TIMEOUT_MS',
] as const

const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]]),
) as Record<(typeof environmentKeys)[number], string | undefined>

const details: AppointmentWhatsAppDetails = {
  recipientName: 'João da Silva',
  customerName: 'João da Silva',
  serviceName: 'Corte e barba',
  barberName: 'Guilherme Santos',
  dateLabel: '20/10/2026',
  time: '14:30',
  priceLabel: 'R$ 75,00',
  businessName: 'Gui Santos Barbearia',
}

function configureMeta() {
  process.env.WHATSAPP_PROVIDER = 'meta'
  process.env.WHATSAPP_GRAPH_API_VERSION = 'v99.1'
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789012345'
  process.env.WHATSAPP_ACCESS_TOKEN = 'token-meta-de-teste'
  process.env.WHATSAPP_TEMPLATE_NAME = 'appointment_notification'
  process.env.WHATSAPP_TEMPLATE_LANGUAGE = 'pt_BR'
  process.env.WHATSAPP_TIMEOUT_MS = '7500'
}

function successfulMetaResponse(messageId = 'wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYFjNFQkQ=') {
  return new Response(
    JSON.stringify({
      messaging_product: 'whatsapp',
      contacts: [{ input: '5511999999999', wa_id: '5511999999999' }],
      messages: [{ id: messageId }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('modelos de WhatsApp para agendamentos', () => {
  const events: AppointmentWhatsAppEvent[] = [
    'appointment_created',
    'appointment_rescheduled',
    'appointment_cancelled',
    'reminder_24h',
    'reminder_2h',
  ]
  const audiences: WhatsAppRecipientAudience[] = ['customer', 'barber', 'admin']

  it.each(events.flatMap((event) => audiences.map((audience) => [event, audience] as const)))(
    'cria um modelo aprovado para %s e %s',
    (event, audience) => {
      const template = createAppointmentWhatsAppTemplate({
        event,
        audience,
        details,
        templateName: 'appointment_notification',
        languageCode: 'pt_BR',
      })

      expect(template).toMatchObject({
        event,
        audience,
        name: 'appointment_notification',
        languageCode: 'pt_BR',
      })
      expect(template.components).toHaveLength(1)
      expect(template.components[0]).toMatchObject({ type: 'body' })
      expect(template.components[0].parameters).toHaveLength(10)
      expect(template.components[0].parameters.every(({ type }) => type === 'text')).toBe(true)
      expect(template.preview).toContain('Cliente: João da Silva')
      expect(template.preview).toContain('Profissional: Guilherme Santos')
      expect(template.preview).toContain('Data: 20/10/2026')
      expect(template.preview).toContain('Horário: 14:30')
    },
  )

  it('mantém a ordem contratada dos dez parâmetros do modelo aprovado', () => {
    const template = createAppointmentWhatsAppTemplate({
      event: 'appointment_created',
      audience: 'customer',
      details,
      templateName: 'appointment_notification',
      languageCode: 'pt_BR',
    })

    expect(template.components[0].parameters.map(({ text }) => text)).toEqual([
      'João',
      'Agendamento confirmado',
      'Seu horário foi confirmado com sucesso.',
      'João da Silva',
      'Corte e barba',
      'Guilherme Santos',
      '20/10/2026',
      '14:30',
      'R$ 75,00',
      'Gui Santos Barbearia',
    ])
  })

  it('gera mensagens específicas para cliente, barbeiro e administrador', () => {
    const contexts = (['customer', 'barber', 'admin'] as const).map((audience) =>
      createAppointmentWhatsAppTemplate({
        event: 'reminder_2h',
        audience,
        details,
        templateName: 'appointment_notification',
        languageCode: 'pt_BR',
      }).components[0].parameters[2].text,
    )

    expect(contexts).toEqual([
      'Seu atendimento será em cerca de 2 horas.',
      'Você tem um atendimento agendado para daqui a cerca de 2 horas.',
      'Há um atendimento da equipe previsto para daqui a cerca de 2 horas.',
    ])
  })

  it('normaliza espaços e usa uma saudação neutra quando o nome está vazio', () => {
    const template = createAppointmentWhatsAppTemplate({
      event: 'appointment_rescheduled',
      audience: 'barber',
      details: {
        ...details,
        recipientName: '   ',
        serviceName: '  Corte\n  masculino  ',
      },
      templateName: 'appointment_notification',
      languageCode: 'pt_BR',
    })

    expect(template.components[0].parameters[0].text).toBe('profissional')
    expect(template.components[0].parameters[4].text).toBe('Corte masculino')
  })

  it.each([
    ['Modelo Inválido', 'pt_BR'],
    ['appointment_notification', 'portugues'],
  ])('rejeita identificação inválida do modelo: %s / %s', (templateName, languageCode) => {
    expect(() =>
      createAppointmentWhatsAppTemplate({
        event: 'appointment_created',
        audience: 'customer',
        details,
        templateName,
        languageCode,
      }),
    ).toThrow()
  })

  it('rejeita campos obrigatórios vazios', () => {
    expect(() =>
      createAppointmentWhatsAppTemplate({
        event: 'appointment_created',
        audience: 'customer',
        details: { ...details, customerName: '  ' },
        templateName: 'appointment_notification',
        languageCode: 'pt_BR',
      }),
    ).toThrow('O campo cliente é obrigatório')
  })
})

describe('provedor de WhatsApp', () => {
  beforeEach(() => {
    for (const key of environmentKeys) delete process.env[key]
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    for (const key of environmentKeys) {
      const originalValue = originalEnvironment[key]
      if (originalValue === undefined) delete process.env[key]
      else process.env[key] = originalValue
    }
  })

  it('pausa a fila quando o provedor está desativado ou incompleto', () => {
    expect(getWhatsAppDispatchState()).toEqual({
      ready: false,
      provider: 'disabled',
      reason: 'disabled',
    })

    process.env.WHATSAPP_PROVIDER = 'meta'
    expect(getWhatsAppDispatchState()).toEqual({
      ready: false,
      provider: 'meta',
      reason: 'misconfigured',
    })

    process.env.WHATSAPP_PROVIDER = 'console'
    expect(getWhatsAppDispatchState()).toEqual({ ready: true, provider: 'console' })
  })

  it.each([
    ['(11) 99999-9999', '5511999999999'],
    ['11 3333-4444', '551133334444'],
    ['+55 (11) 99999-9999', '5511999999999'],
    ['0055 11 99999-9999', '5511999999999'],
  ])('normaliza o telefone brasileiro %s para %s', (input, expected) => {
    expect(normalizeBrazilianWhatsAppNumber(input)).toBe(expected)
  })

  it.each(['', '9999-9999', '+1 202 555 0123', '05511999999999', '5500999999999'])(
    'rejeita o telefone inválido %s sem permitir nova tentativa',
    (input) => {
      try {
        normalizeBrazilianWhatsAppNumber(input)
        throw new Error('Era esperado um erro de validação.')
      } catch (error) {
        expect(error).toBeInstanceOf(WhatsAppDeliveryError)
        expect((error as WhatsAppDeliveryError).retryable).toBe(false)
      }
    },
  )

  it('mascara o telefone e mantém somente os quatro últimos dígitos', () => {
    expect(maskWhatsAppNumber('+55 (11) 99999-1234')).toBe('••••1234')
    expect(maskWhatsAppNumber('12')).toBe('••••')
  })

  it('fica desativado por padrão e não faz chamadas externas', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendAppointmentWhatsApp({
      to: 'telefone ainda não informado',
      event: 'appointment_created',
      audience: 'customer',
      details,
    })

    expect(result).toEqual({
      accepted: false,
      previewed: false,
      skipped: true,
      provider: 'disabled',
      maskedRecipient: '••••',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('retorna uma prévia no modo console sem fazer chamadas externas nem registrar o telefone', async () => {
    process.env.WHATSAPP_PROVIDER = 'console'
    const fetchMock = vi.fn()
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendAppointmentWhatsApp({
      to: '(11) 99999-9999',
      event: 'reminder_24h',
      audience: 'barber',
      details,
    })

    expect(result).toMatchObject({
      accepted: false,
      previewed: true,
      skipped: false,
      provider: 'console',
      maskedRecipient: '••••9999',
    })
    expect(result.preview).toContain('cerca de 24 horas')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(infoSpy).toHaveBeenCalledOnce()
    expect(infoSpy.mock.calls[0][0]).toContain('••••9999')
    expect(infoSpy.mock.calls[0][0]).not.toContain('5511999999999')
  })

  it('envia somente um modelo aprovado no formato esperado pela API oficial da Meta', async () => {
    configureMeta()
    const fetchMock = vi.fn().mockResolvedValue(successfulMetaResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendAppointmentWhatsApp({
      to: '(11) 99999-9999',
      event: 'appointment_created',
      audience: 'customer',
      details,
    })

    expect(result).toMatchObject({
      accepted: true,
      previewed: false,
      skipped: false,
      provider: 'meta',
      maskedRecipient: '••••9999',
      messageId: 'wamid.HBgNNTUxMTk5OTk5OTk5ORUCABIYFjNFQkQ=',
    })
    expect(fetchMock).toHaveBeenCalledOnce()

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://graph.facebook.com/v99.1/123456789012345/messages')
    expect(options).toMatchObject({
      method: 'POST',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer token-meta-de-teste',
        'Content-Type': 'application/json',
      },
    })
    expect(options.signal).toBeInstanceOf(AbortSignal)

    const body = JSON.parse(String(options.body))
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '5511999999999',
      type: 'template',
      template: {
        name: 'appointment_notification',
        language: { code: 'pt_BR' },
      },
    })
    expect(body).not.toHaveProperty('text')
    expect(body.template.components[0].parameters).toHaveLength(10)
  })

  it.each([
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
    [403, false],
  ])('classifica a resposta HTTP %i com retryable=%s', async (status, retryable) => {
    configureMeta()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: 'detalhe externo que não deve ser propagado',
              code: 131000,
            },
          }),
          { status, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    try {
      await sendAppointmentWhatsApp({
        to: '11999999999',
        event: 'appointment_created',
        audience: 'customer',
        details,
      })
      throw new Error('Era esperado um erro de entrega.')
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppDeliveryError)
      expect((error as WhatsAppDeliveryError).retryable).toBe(retryable)
      expect((error as WhatsAppDeliveryError).statusCode).toBe(status)
      expect((error as WhatsAppDeliveryError).providerCode).toBe(131000)
      expect((error as Error).message).not.toContain('detalhe externo')
    }
  })

  it('trata timeout como falha temporária sem propagar dados do erro externo', async () => {
    configureMeta()
    const timeoutError = new Error(
      'Timeout com token-meta-de-teste e telefone 5511999999999',
    )
    timeoutError.name = 'TimeoutError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError))

    try {
      await sendAppointmentWhatsApp({
        to: '11999999999',
        event: 'reminder_2h',
        audience: 'customer',
        details,
      })
      throw new Error('Era esperado um timeout.')
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppDeliveryError)
      expect((error as WhatsAppDeliveryError).retryable).toBe(true)
      expect((error as Error).message).toBe('O envio pelo WhatsApp excedeu o tempo limite.')
      expect((error as Error).message).not.toContain('token-meta-de-teste')
      expect((error as Error).message).not.toContain('5511999999999')
    }
  })

  it('trata uma resposta sem wamid válido como falha temporária', async () => {
    configureMeta()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulMetaResponse('id-invalido')))

    await expect(
      sendAppointmentWhatsApp({
        to: '11999999999',
        event: 'appointment_created',
        audience: 'admin',
        details,
      }),
    ).rejects.toMatchObject({
      message: 'O provedor do WhatsApp retornou uma resposta inválida.',
      retryable: true,
      statusCode: 200,
    })
  })

  it('exige toda a configuração da Meta sem revelar credenciais', async () => {
    process.env.WHATSAPP_PROVIDER = 'meta'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456789012345'
    process.env.WHATSAPP_ACCESS_TOKEN = 'segredo-super-sensivel'

    await expect(
      sendAppointmentWhatsApp({
        to: '11999999999',
        event: 'appointment_created',
        audience: 'customer',
        details,
      }),
    ).rejects.toEqual(expect.any(WhatsAppConfigurationError))

    try {
      await sendAppointmentWhatsApp({
        to: '11999999999',
        event: 'appointment_created',
        audience: 'customer',
        details,
      })
    } catch (error) {
      expect((error as Error).message).not.toContain('segredo-super-sensivel')
      expect((error as Error).message).not.toContain('123456789012345')
    }
  })

  it('rejeita um provedor desconhecido', async () => {
    process.env.WHATSAPP_PROVIDER = 'qualquer-coisa'

    await expect(
      sendAppointmentWhatsApp({
        to: '11999999999',
        event: 'appointment_created',
        audience: 'customer',
        details,
      }),
    ).rejects.toThrow('WHATSAPP_PROVIDER deve ser disabled, console ou meta.')
  })
})
