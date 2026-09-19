const secret = process.env.CRON_SECRET?.trim()
const appUrl = process.env.APP_URL?.trim() || 'http://localhost:3000'

if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
  throw new Error('Configure CRON_SECRET com pelo menos 32 caracteres antes de processar notificações.')
}

let publicOrigin
try {
  publicOrigin = new URL(appUrl)
  const isLoopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(
    publicOrigin.hostname.toLowerCase(),
  )
  if (!['http:', 'https:'].includes(publicOrigin.protocol)) throw new Error()
  if (
    publicOrigin.username ||
    publicOrigin.password ||
    publicOrigin.search ||
    publicOrigin.hash ||
    publicOrigin.pathname !== '/'
  ) {
    throw new Error()
  }
  if (publicOrigin.protocol !== 'https:' && !isLoopback) {
    throw new Error('APP_URL precisa usar HTTPS fora da máquina local.')
  }
} catch (error) {
  if (error instanceof Error && error.message.startsWith('APP_URL')) throw error
  throw new Error('APP_URL deve ser uma origem HTTP ou HTTPS válida.')
}

const endpoint = new URL('/api/notifications/process', publicOrigin)
const response = await fetch(endpoint, {
  method: 'POST',
  redirect: 'error',
  headers: { authorization: `Bearer ${secret}` },
})
const body = await response.json().catch(() => null)

if (!response.ok) {
  throw new Error(body?.message || `Falha ao processar notificações: HTTP ${response.status}.`)
}

console.log(
  `Notificações processadas: ${body.processed}; enviadas: ${body.sent}; falhas: ${body.failed}; lembretes criados: ${body.queued}.`,
)
