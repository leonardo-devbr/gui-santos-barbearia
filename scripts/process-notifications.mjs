const secret = process.env.CRON_SECRET?.trim()
const appUrl = process.env.APP_URL?.trim() || 'http://localhost:3000'

if (!secret) {
  throw new Error('Configure CRON_SECRET no arquivo .env.local antes de processar notificações.')
}

const endpoint = new URL('/api/notifications/process', appUrl)
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { authorization: `Bearer ${secret}` },
})
const body = await response.json().catch(() => null)

if (!response.ok) {
  throw new Error(body?.message || `Falha ao processar notificações: HTTP ${response.status}.`)
}

console.log(
  `Notificações processadas: ${body.processed}; enviadas: ${body.sent}; falhas: ${body.failed}; lembretes criados: ${body.queued}.`,
)
