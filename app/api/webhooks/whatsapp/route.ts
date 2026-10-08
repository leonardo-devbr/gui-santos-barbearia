import {
  applyWhatsAppWebhookStatusEvents,
  extractWhatsAppWebhookStatusEvents,
  getWhatsAppAppSecret,
  getWhatsAppWebhookVerifyToken,
  readWhatsAppWebhookRawBody,
  verifyWhatsAppWebhookSignature,
  verifyWhatsAppWebhookToken,
  WhatsAppWebhookConfigurationError,
  WhatsAppWebhookPayloadError,
  WhatsAppWebhookPayloadTooLargeError,
} from '@/lib/whatsapp-webhook'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const noStoreHeaders = { 'Cache-Control': 'no-store' }

function jsonResponse(body: object, status = 200) {
  return Response.json(body, { status, headers: noStoreHeaders })
}

function configurationUnavailableResponse() {
  return jsonResponse({ message: 'Webhook do WhatsApp não configurado.' }, 503)
}

export async function GET(request: Request) {
  let expectedToken: string
  try {
    expectedToken = getWhatsAppWebhookVerifyToken()
  } catch (error) {
    if (error instanceof WhatsAppWebhookConfigurationError) {
      return configurationUnavailableResponse()
    }
    throw error
  }

  const searchParams = new URL(request.url).searchParams
  const mode = searchParams.get('hub.mode')
  const receivedToken = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (
    mode !== 'subscribe' ||
    receivedToken === null ||
    challenge === null ||
    challenge.length === 0 ||
    challenge.length > 256 ||
    !verifyWhatsAppWebhookToken(receivedToken, expectedToken)
  ) {
    return jsonResponse({ message: 'Verificação recusada.' }, 403)
  }

  return new Response(challenge, {
    status: 200,
    headers: {
      ...noStoreHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export async function POST(request: Request) {
  let appSecret: string
  try {
    appSecret = getWhatsAppAppSecret()
  } catch (error) {
    if (error instanceof WhatsAppWebhookConfigurationError) {
      return configurationUnavailableResponse()
    }
    throw error
  }

  let rawBody: Uint8Array
  try {
    rawBody = await readWhatsAppWebhookRawBody(request)
  } catch (error) {
    if (error instanceof WhatsAppWebhookPayloadTooLargeError) {
      return jsonResponse({ message: 'Payload muito grande.' }, 413)
    }
    return jsonResponse({ message: 'Não foi possível ler o payload.' }, 400)
  }

  if (
    !verifyWhatsAppWebhookSignature(
      rawBody,
      request.headers.get('x-hub-signature-256'),
      appSecret,
    )
  ) {
    return jsonResponse({ message: 'Assinatura inválida.' }, 401)
  }

  let payload: unknown
  try {
    const json = new TextDecoder('utf-8', { fatal: true }).decode(rawBody)
    payload = JSON.parse(json) as unknown
  } catch {
    return jsonResponse({ message: 'JSON inválido.' }, 400)
  }

  let events
  try {
    events = extractWhatsAppWebhookStatusEvents(payload)
  } catch (error) {
    if (error instanceof WhatsAppWebhookPayloadError) {
      return jsonResponse({ message: 'Payload inválido.' }, 400)
    }
    throw error
  }

  try {
    await applyWhatsAppWebhookStatusEvents(events)
  } catch {
    return jsonResponse({ message: 'Não foi possível processar o webhook.' }, 500)
  }

  return jsonResponse({ received: true })
}
