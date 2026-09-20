import { describe, expect, it } from 'vitest'
import {
  createAppointmentEmail,
  createEmailVerificationEmail,
  createPasswordResetEmail,
  type AppointmentEmailType,
} from '@/lib/email-templates'

describe('templates de e-mail', () => {
  it('gera a recuperação de senha com nome, assunto e validade', () => {
    const email = createPasswordResetEmail({
      customerName: '  Ana Maria  ',
      resetUrl: 'https://example.com/redefinir?token=abc',
      businessName: 'Gui Santos Barbearia',
    })

    expect(email.subject).toBe('Redefinição de senha | Gui Santos Barbearia')
    expect(email.text).toContain('Olá, Ana.')
    expect(email.text).toContain('https://example.com/redefinir?token=abc')
    expect(email.text).toContain('expira em 1 hora')
  })

  it('usa uma saudação neutra quando o nome está vazio', () => {
    const email = createPasswordResetEmail({
      customerName: '   ',
      resetUrl: 'https://example.com/redefinir',
      businessName: 'Gui Santos Barbearia',
    })

    expect(email.text).toContain('Olá, cliente.')
  })

  it.each([
    ['registration', 'Confirme seu cadastro', 'ativar a conta'],
    ['email_change', 'Confirme seu novo e-mail', 'concluir a alteração'],
  ] as const)('gera a verificação para %s', (purpose, title, instruction) => {
    const email = createEmailVerificationEmail({
      customerName: 'João Silva',
      verificationUrl: 'https://example.com/verificar?token=abc',
      businessName: 'Gui Santos Barbearia',
      purpose,
    })

    expect(email.subject).toBe(`${title} | Gui Santos Barbearia`)
    expect(email.html).toContain(title)
    expect(email.text).toContain(instruction)
    expect(email.text).toContain('expira em 24 horas')
  })

  it.each([
    ['appointment_created', 'Agendamento confirmado', 'Ver meus agendamentos'],
    ['appointment_rescheduled', 'Agendamento remarcado', 'Ver meus agendamentos'],
    ['appointment_cancelled', 'Agendamento cancelado', 'Fazer novo agendamento'],
    ['appointment_reminder', 'Seu horário está chegando', 'Ver meus agendamentos'],
  ] as Array<[AppointmentEmailType, string, string]>) (
    'gera a mensagem de agendamento %s',
    (type, title, actionLabel) => {
      const email = createAppointmentEmail(type, {
        customerName: 'João Silva',
        serviceName: 'Corte',
        barberName: 'Guilherme',
        dateLabel: '20/09/2026',
        time: '09:00',
        priceLabel: 'R$ 40,00',
        businessName: 'Gui Santos Barbearia',
        appointmentsUrl: 'https://example.com/agendamentos',
      })

      expect(email.subject).toBe(`${title} | Gui Santos Barbearia`)
      expect(email.html).toContain(title)
      expect(email.html).toContain(actionLabel)
      expect(email.text).toContain('Corte com Guilherme, em 20/09/2026 às 09:00.')
      expect(email.text).toContain('Valor: R$ 40,00.')
    },
  )

  it('escapa dados externos antes de inseri-los no HTML', () => {
    const email = createPasswordResetEmail({
      customerName: '<script>alert(1)</script> Silva',
      resetUrl: `https://example.com/reset?token="x"&next='<script>'`,
      businessName: 'Barbearia <Admin> & "Co"',
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).toContain('Barbearia &lt;Admin&gt; &amp; &quot;Co&quot;')
    expect(email.html).toContain(
      'https://example.com/reset?token=&quot;x&quot;&amp;next=&#039;&lt;script&gt;&#039;',
    )
  })
})
