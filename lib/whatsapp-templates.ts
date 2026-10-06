import 'server-only'

export const appointmentWhatsAppEvents = [
  'appointment_created',
  'appointment_rescheduled',
  'appointment_cancelled',
  'reminder_24h',
  'reminder_2h',
] as const

export const whatsAppRecipientAudiences = ['customer', 'barber', 'admin'] as const

export type AppointmentWhatsAppEvent = (typeof appointmentWhatsAppEvents)[number]
export type WhatsAppRecipientAudience = (typeof whatsAppRecipientAudiences)[number]

export interface AppointmentWhatsAppDetails {
  recipientName: string
  customerName: string
  serviceName: string
  barberName: string
  dateLabel: string
  time: string
  priceLabel: string
  businessName: string
}

export interface WhatsAppTemplateParameter {
  type: 'text'
  text: string
}

export interface WhatsAppTemplateComponent {
  type: 'body'
  parameters: WhatsAppTemplateParameter[]
}

export interface AppointmentWhatsAppTemplate {
  event: AppointmentWhatsAppEvent
  audience: WhatsAppRecipientAudience
  name: string
  languageCode: string
  components: WhatsAppTemplateComponent[]
  preview: string
}

export class WhatsAppTemplateError extends Error {}

export const whatsappTemplateParameterOrder = [
  'destinatário',
  'título do aviso',
  'contexto do destinatário',
  'cliente',
  'serviço',
  'barbeiro',
  'data',
  'horário',
  'valor',
  'empresa',
] as const

const eventTitles: Record<AppointmentWhatsAppEvent, string> = {
  appointment_created: 'Agendamento confirmado',
  appointment_rescheduled: 'Agendamento remarcado',
  appointment_cancelled: 'Agendamento cancelado',
  reminder_24h: 'Lembrete de atendimento em 24 horas',
  reminder_2h: 'Lembrete de atendimento em 2 horas',
}

const audienceContexts: Record<
  WhatsAppRecipientAudience,
  Record<AppointmentWhatsAppEvent, string>
> = {
  customer: {
    appointment_created: 'Seu horário foi confirmado com sucesso.',
    appointment_rescheduled: 'Seu horário foi atualizado.',
    appointment_cancelled: 'O cancelamento do seu horário foi registrado.',
    reminder_24h: 'Seu atendimento será em cerca de 24 horas.',
    reminder_2h: 'Seu atendimento será em cerca de 2 horas.',
  },
  barber: {
    appointment_created: 'Um novo atendimento foi incluído na sua agenda.',
    appointment_rescheduled: 'Um atendimento da sua agenda foi remarcado.',
    appointment_cancelled: 'Um atendimento da sua agenda foi cancelado.',
    reminder_24h: 'Você tem um atendimento agendado para daqui a cerca de 24 horas.',
    reminder_2h: 'Você tem um atendimento agendado para daqui a cerca de 2 horas.',
  },
  admin: {
    appointment_created: 'Um novo atendimento foi incluído na agenda da equipe.',
    appointment_rescheduled: 'Um atendimento da equipe foi remarcado.',
    appointment_cancelled: 'Um atendimento da equipe foi cancelado.',
    reminder_24h: 'Há um atendimento da equipe previsto para daqui a cerca de 24 horas.',
    reminder_2h: 'Há um atendimento da equipe previsto para daqui a cerca de 2 horas.',
  },
}

function normalizeTemplateText(value: string, field: string, fallback?: string) {
  const normalized = value.replaceAll(/\s+/g, ' ').trim() || fallback

  if (!normalized) {
    throw new WhatsAppTemplateError(`O campo ${field} é obrigatório para o aviso do WhatsApp.`)
  }
  if (normalized.length > 512) {
    throw new WhatsAppTemplateError(`O campo ${field} excede o limite do aviso do WhatsApp.`)
  }

  return normalized
}

function validateTemplateIdentity(name: string, languageCode: string) {
  if (!/^[a-z0-9_]{1,512}$/.test(name)) {
    throw new WhatsAppTemplateError('O nome do modelo aprovado do WhatsApp é inválido.')
  }
  if (!/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(languageCode)) {
    throw new WhatsAppTemplateError('O idioma do modelo aprovado do WhatsApp é inválido.')
  }
}

function getRecipientFallback(audience: WhatsAppRecipientAudience) {
  if (audience === 'barber') return 'profissional'
  if (audience === 'admin') return 'administrador'
  return 'cliente'
}

export function createAppointmentWhatsAppTemplate({
  event,
  audience,
  details,
  templateName,
  languageCode,
}: {
  event: AppointmentWhatsAppEvent
  audience: WhatsAppRecipientAudience
  details: AppointmentWhatsAppDetails
  templateName: string
  languageCode: string
}): AppointmentWhatsAppTemplate {
  validateTemplateIdentity(templateName, languageCode)

  const values = [
    normalizeTemplateText(
      details.recipientName.trim().split(/\s+/)[0] ?? '',
      'nome do destinatário',
      getRecipientFallback(audience),
    ),
    eventTitles[event],
    audienceContexts[audience][event],
    normalizeTemplateText(details.customerName, 'cliente'),
    normalizeTemplateText(details.serviceName, 'serviço'),
    normalizeTemplateText(details.barberName, 'barbeiro'),
    normalizeTemplateText(details.dateLabel, 'data'),
    normalizeTemplateText(details.time, 'horário'),
    normalizeTemplateText(details.priceLabel, 'valor'),
    normalizeTemplateText(details.businessName, 'empresa'),
  ]

  const [recipient, title, context, customer, service, barber, date, time, price, business] =
    values
  const preview = [
    `Olá, ${recipient}.`,
    title,
    context,
    `Cliente: ${customer}`,
    `Serviço: ${service}`,
    `Profissional: ${barber}`,
    `Data: ${date}`,
    `Horário: ${time}`,
    `Valor: ${price}`,
    business,
  ].join('\n')

  return {
    event,
    audience,
    name: templateName,
    languageCode,
    components: [
      {
        type: 'body',
        parameters: values.map((text) => ({ type: 'text', text })),
      },
    ],
    preview,
  }
}
