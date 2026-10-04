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

function readBooleanSetting(name: string, fallback: boolean) {
  const value = process.env[name]?.trim()
  if (!value) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new EmailConfigurationError(`${name} deve ser true ou false.`)
}

function isLoopbackHostname(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname.toLowerCase())
}

function getTransporter() {
  if (global.smtpTransporter) return global.smtpTransporter

  const host = process.env.SMTP_HOST?.trim()
  const from = process.env.SMTP_FROM?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASSWORD ?? ''
  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = readBooleanSetting('SMTP_SECURE', port === 465)

  if (!host && !from && !user && !pass) return null
  if (!host || !from) {
    throw new EmailConfigurationError('SMTP_HOST e SMTP_FROM devem ser configurados juntos.')
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError('SMTP_PORT deve ser uma porta válida.')
  }
  if (Boolean(user) !== Boolean(pass)) {
    throw new EmailConfigurationError('SMTP_USER e SMTP_PASSWORD devem ser configurados juntos.')
  }
  if (/[\r\n]/.test(from)) {
    throw new EmailConfigurationError('SMTP_FROM contém caracteres inválidos.')
  }

  global.smtpTransporter = nodemailer.createTransport(
    {
      host,
      port,
      secure,
      requireTLS: !secure,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      },
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
  const configuredUrl = process.env.APP_URL?.trim()
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Protocolo inválido.')
      }
      if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new Error('APP_URL deve conter somente a origem pública.')
      }
      if (
        process.env.NODE_ENV === 'production' &&
        url.protocol !== 'https:' &&
        !isLoopbackHostname(url.hostname)
      ) {
        throw new EmailConfigurationError('APP_URL deve usar HTTPS em produção.')
      }
      return url.origin
    } catch (error) {
      if (error instanceof EmailConfigurationError) throw error
      throw new EmailConfigurationError('APP_URL deve ser uma origem HTTP ou HTTPS válida.')
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
