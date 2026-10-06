import 'server-only'

import {
  createAppointmentWhatsAppTemplate,
  type AppointmentWhatsAppDetails,
  type AppointmentWhatsAppEvent,
  type AppointmentWhatsAppTemplate,
  type WhatsAppRecipientAudience,
} from '@/lib/whatsapp-templates'

export type WhatsAppProvider = 'disabled' | 'console' | 'meta'

export interface WhatsAppDeliveryResult {
  accepted: boolean
  previewed: boolean
  skipped: boolean
  provider: WhatsAppProvider
  maskedRecipient: string
  messageId?: string
  preview?: string
}

export class WhatsAppConfigurationError extends Error {}

export class WhatsAppDeliveryError extends Error {
  readonly retryable: boolean
  readonly statusCode?: number
  readonly providerCode?: number

  constructor(
    message: string,
    {
      retryable,
      statusCode,
      providerCode,
    }: { retryable: boolean; statusCode?: number; providerCode?: number },
  ) {
    super(message)
    this.retryable = retryable
    this.statusCode = statusCode
    this.providerCode = providerCode
  }
}

interface DisabledConfiguration {
  provider: 'disabled'
}

interface EnabledConfiguration {
  provider: 'console' | 'meta'
  templateName: string
  languageCode: string
}

interface ConsoleConfiguration extends EnabledConfiguration {
  provider: 'console'
}

interface MetaConfiguration extends EnabledConfiguration {
  provider: 'meta'
  graphApiVersion: string
  phoneNumberId: string
  accessToken: string
  timeoutMs: number
}

type WhatsAppConfiguration = DisabledConfiguration | ConsoleConfiguration | MetaConfiguration

const defaultTemplateName = 'appointment_notification'
const defaultTemplateLanguage = 'pt_BR'
const defaultTimeoutMs = 10_000

function readProvider(): WhatsAppProvider {
  const value = process.env.WHATSAPP_PROVIDER?.trim().toLowerCase()
  if (!value || value === 'disabled') return 'disabled'
  if (value === 'console' || value === 'meta') return value
  throw new WhatsAppConfigurationError(
    'WHATSAPP_PROVIDER deve ser disabled, console ou meta.',
  )
}

function readTemplateSettings() {
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || defaultTemplateName
  const languageCode =
    process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || defaultTemplateLanguage

  if (!/^[a-z0-9_]{1,512}$/.test(templateName)) {
    throw new WhatsAppConfigurationError('WHATSAPP_TEMPLATE_NAME possui formato inválido.')
  }
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(languageCode)) {
    throw new WhatsAppConfigurationError('WHATSAPP_TEMPLATE_LANGUAGE possui formato inválido.')
  }

  return { templateName, languageCode }
}

function readMetaConfiguration(settings: ReturnType<typeof readTemplateSettings>): MetaConfiguration {
  const graphApiVersion = process.env.WHATSAPP_GRAPH_API_VERSION?.trim()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const timeoutMs = Number(process.env.WHATSAPP_TIMEOUT_MS?.trim() || defaultTimeoutMs)

  if (!graphApiVersion || !/^v\d+\.\d+$/.test(graphApiVersion)) {
    throw new WhatsAppConfigurationError(
      'WHATSAPP_GRAPH_API_VERSION deve ser configurada no formato vN.N.',
    )
  }
  if (!phoneNumberId || !/^\d{5,32}$/.test(phoneNumberId)) {
    throw new WhatsAppConfigurationError('WHATSAPP_PHONE_NUMBER_ID não foi configurado corretamente.')
  }
  if (!accessToken || /[\s\r\n]/.test(accessToken)) {
    throw new WhatsAppConfigurationError('WHATSAPP_ACCESS_TOKEN não foi configurado corretamente.')
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new WhatsAppConfigurationError(
      'WHATSAPP_TIMEOUT_MS deve ser um inteiro entre 1000 e 60000.',
    )
  }

  return {
    provider: 'meta',
    ...settings,
    graphApiVersion,
    phoneNumberId,
    accessToken,
    timeoutMs,
  }
}

function getWhatsAppConfiguration(): WhatsAppConfiguration {
  const provider = readProvider()
  if (provider === 'disabled') return { provider }

  const settings = readTemplateSettings()
  if (provider === 'console') return { provider, ...settings }
  return readMetaConfiguration(settings)
}

export function normalizeBrazilianWhatsAppNumber(value: string) {
  let digits = value.replaceAll(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`

  if (!/^55[1-9]\d[1-9]\d{7,8}$/.test(digits)) {
    throw new WhatsAppDeliveryError('O telefone do destinatário é inválido para o WhatsApp.', {
      retryable: false,
    })
  }

  return digits
}

export function maskWhatsAppNumber(value: string) {
  const digits = value.replaceAll(/\D/g, '')
  if (digits.length < 4) return '••••'
  return `••••${digits.slice(-4)}`
}

function getProviderCode(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return undefined
  const error = payload.error
  if (!error || typeof error !== 'object' || !('code' in error)) return undefined
  return typeof error.code === 'number' && Number.isInteger(error.code) ? error.code : undefined
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function getWhatsAppMessageId(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('messages' in payload)) return undefined
  if (!Array.isArray(payload.messages)) return undefined

  const firstMessage = payload.messages[0]
  if (!firstMessage || typeof firstMessage !== 'object' || !('id' in firstMessage)) return undefined
  if (typeof firstMessage.id !== 'string') return undefined
  if (!/^wamid\.[A-Za-z0-9+/=_-]{1,500}$/.test(firstMessage.id)) return undefined
  return firstMessage.id
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  )
}

async function deliverWithMeta({
  to,
  template,
  configuration,
}: {
  to: string
  template: AppointmentWhatsAppTemplate
  configuration: MetaConfiguration
}): Promise<WhatsAppDeliveryResult> {
  const maskedRecipient = maskWhatsAppNumber(to)
  const endpoint = `https://graph.facebook.com/${configuration.graphApiVersion}/${configuration.phoneNumberId}/messages`

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${configuration.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.languageCode },
          components: template.components,
        },
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(configuration.timeoutMs),
    })
  } catch (error) {
    const timedOut = isTimeoutError(error)
    throw new WhatsAppDeliveryError(
      timedOut
        ? 'O envio pelo WhatsApp excedeu o tempo limite.'
        : 'Não foi possível se comunicar com o provedor do WhatsApp.',
      { retryable: true },
    )
  }

  const payload = await readJsonSafely(response)

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500
    throw new WhatsAppDeliveryError(
      retryable
        ? 'O provedor do WhatsApp está temporariamente indisponível.'
        : 'O provedor do WhatsApp rejeitou o envio.',
      {
        retryable,
        statusCode: response.status,
        providerCode: getProviderCode(payload),
      },
    )
  }

  const messageId = getWhatsAppMessageId(payload)
  if (!messageId) {
    throw new WhatsAppDeliveryError('O provedor do WhatsApp retornou uma resposta inválida.', {
      retryable: true,
      statusCode: response.status,
    })
  }

  return {
    accepted: true,
    previewed: false,
    skipped: false,
    provider: 'meta',
    maskedRecipient,
    messageId,
  }
}

export async function sendWhatsAppTemplate({
  to,
  template,
}: {
  to: string
  template: AppointmentWhatsAppTemplate
}): Promise<WhatsAppDeliveryResult> {
  const configuration = getWhatsAppConfiguration()
  const maskedRecipient = maskWhatsAppNumber(to)

  if (configuration.provider === 'disabled') {
    return {
      accepted: false,
      previewed: false,
      skipped: true,
      provider: 'disabled',
      maskedRecipient,
    }
  }

  const normalizedRecipient = normalizeBrazilianWhatsAppNumber(to)
  if (configuration.provider === 'console') {
    console.info(
      `[Prévia de WhatsApp] Destinatário: ${maskWhatsAppNumber(normalizedRecipient)}; evento: ${template.event}; público: ${template.audience}`,
    )
    return {
      accepted: false,
      previewed: true,
      skipped: false,
      provider: 'console',
      maskedRecipient: maskWhatsAppNumber(normalizedRecipient),
      preview: template.preview,
    }
  }

  return deliverWithMeta({
    to: normalizedRecipient,
    template,
    configuration,
  })
}

export async function sendAppointmentWhatsApp({
  to,
  event,
  audience,
  details,
}: {
  to: string
  event: AppointmentWhatsAppEvent
  audience: WhatsAppRecipientAudience
  details: AppointmentWhatsAppDetails
}): Promise<WhatsAppDeliveryResult> {
  const configuration = getWhatsAppConfiguration()

  if (configuration.provider === 'disabled') {
    return {
      accepted: false,
      previewed: false,
      skipped: true,
      provider: 'disabled',
      maskedRecipient: maskWhatsAppNumber(to),
    }
  }

  const template = createAppointmentWhatsAppTemplate({
    event,
    audience,
    details,
    templateName: configuration.templateName,
    languageCode: configuration.languageCode,
  })

  return sendWhatsAppTemplate({ to, template })
}
