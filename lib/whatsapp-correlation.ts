import 'server-only'

const callbackPattern =
  /^wn1:([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}):([1-9]\d{0,2})$/i

export interface WhatsAppNotificationCorrelation {
  notificationId: string
  attempt: number
}

export function createWhatsAppNotificationCallbackData(
  notificationId: string,
  attempt: number,
) {
  const callbackData = `wn1:${notificationId.toLowerCase()}:${attempt}`
  const correlation = parseWhatsAppNotificationCallbackData(callbackData)
  if (!correlation) {
    throw new Error('Os dados de correlação do aviso do WhatsApp são inválidos.')
  }
  return callbackData
}

export function parseWhatsAppNotificationCallbackData(
  value: unknown,
): WhatsAppNotificationCorrelation | undefined {
  if (typeof value !== 'string' || value.length > 512) return undefined
  const match = callbackPattern.exec(value)
  if (!match) return undefined

  const attempt = Number(match[2])
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 255) return undefined
  return { notificationId: match[1].toLowerCase(), attempt }
}
