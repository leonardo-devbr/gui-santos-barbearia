interface EmailTemplate {
  subject: string
  text: string
  html: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function renderEmail({
  title,
  intro,
  content,
  actionLabel,
  actionUrl,
  businessName,
}: {
  title: string
  intro: string
  content: string
  actionLabel?: string
  actionUrl?: string
  businessName: string
}) {
  const action =
    actionLabel && actionUrl
      ? `<p style="margin:28px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#d4a94e;color:#141210;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${escapeHtml(actionLabel)}</a></p>`
      : ''

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#0a0a0a;color:#f5f5f5;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#171717;border:1px solid #2d2d2d;border-radius:14px;padding:32px">
        <p style="margin:0 0 18px;color:#d4a94e;font-size:12px;letter-spacing:2px;text-transform:uppercase">${escapeHtml(businessName)}</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>
        <p style="margin:0 0 18px;color:#c7c7c7;line-height:1.6">${escapeHtml(intro)}</p>
        ${content}
        ${action}
        <p style="margin:28px 0 0;color:#8c8c8c;font-size:12px;line-height:1.5">Se você não reconhece esta solicitação, ignore esta mensagem.</p>
      </div>
    </div>
  </body>
</html>`
}

export function createPasswordResetEmail({
  customerName,
  resetUrl,
  businessName,
}: {
  customerName: string
  resetUrl: string
  businessName: string
}): EmailTemplate {
  const firstName = customerName.trim().split(/\s+/)[0] || 'cliente'
  const subject = `Redefinição de senha | ${businessName}`
  const text = `Olá, ${firstName}. Use o link abaixo para redefinir sua senha. Ele expira em 1 hora:\n\n${resetUrl}\n\nSe você não solicitou a alteração, ignore esta mensagem.`
  const html = renderEmail({
    title: 'Redefina sua senha',
    intro: `Olá, ${firstName}. Recebemos uma solicitação para alterar a senha da sua conta.`,
    content:
      '<p style="margin:0;color:#c7c7c7;line-height:1.6">O botão abaixo é válido por 1 hora e pode ser usado somente uma vez.</p>',
    actionLabel: 'Criar nova senha',
    actionUrl: resetUrl,
    businessName,
  })
  return { subject, text, html }
}
