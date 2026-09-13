import 'server-only'

import nodemailer, { type Transporter } from 'nodemailer'

declare global {
  var smtpTransporter: Transporter | undefined
}

export interface EmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

export interface EmailDeliveryResult {
  delivered: boolean
  previewed: boolean
  messageId?: string
}

export class EmailConfigurationError extends Error {}

function getTransporter() {
  if (global.smtpTransporter) return global.smtpTransporter

  const host = process.env.SMTP_HOST?.trim()
  const from = process.env.SMTP_FROM?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASSWORD ?? ''
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  if (!host || !from) return null
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError('SMTP_PORT deve ser uma porta válida.')
  }
  if (Boolean(user) !== Boolean(pass)) {
    throw new EmailConfigurationError('SMTP_USER e SMTP_PASSWORD devem ser configurados juntos.')
  }

  global.smtpTransporter = nodemailer.createTransport(
    {
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      pool: true,
      maxConnections: 3,
      disableFileAccess: true,
      disableUrlAccess: true,
    },
    { from },
  )
  return global.smtpTransporter
}

export function getPublicAppUrl(requestUrl?: string) {
  const configuredUrl = process.env.APP_URL?.trim().replace(/\/$/, '')
  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin
    } catch {
      throw new EmailConfigurationError('APP_URL deve ser uma URL válida.')
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new EmailConfigurationError('APP_URL precisa ser configurada em produção.')
  }
  if (requestUrl) return new URL(requestUrl).origin
  return 'http://localhost:3000'
}

export async function sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
  const transporter = getTransporter()

  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new EmailConfigurationError('O servidor SMTP ainda não foi configurado.')
    }

    console.info(`[Prévia de e-mail] Para: ${message.to}\nAssunto: ${message.subject}\n${message.text}`)
    return { delivered: false, previewed: true }
  }

  const result = await transporter.sendMail({
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  })

  return { delivered: true, previewed: false, messageId: result.messageId }
}
