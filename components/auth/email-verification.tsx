'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, LoaderCircle, MailCheck, MailWarning } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'

interface VerificationResponse {
  message?: string
}

export function EmailVerification({ token }: { token?: string }) {
  const [status, setStatus] = useState<'ready' | 'loading' | 'success' | 'error'>(
    token ? 'ready' : 'error',
  )
  const [message, setMessage] = useState(
    token
      ? 'Confirme abaixo para validar que este endereço de e-mail pertence a você.'
      : 'Este link não contém um token de confirmação.',
  )
  const [canRetry, setCanRetry] = useState(false)

  async function verify() {
    if (!token || status === 'loading') return
    setStatus('loading')
    setCanRetry(false)
    setMessage('Estamos validando seu link de confirmação.')
    window.history.replaceState(window.history.state, '', '/verificar-email')

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const result = (await response.json().catch(() => null)) as VerificationResponse | null

      if (!response.ok) {
        setStatus('error')
        setMessage(result?.message ?? 'Não foi possível confirmar este e-mail.')
        return
      }

      setStatus('success')
      setMessage(result?.message ?? 'E-mail confirmado com sucesso.')
    } catch {
      setStatus('error')
      setCanRetry(true)
      setMessage('Não foi possível conectar ao servidor. Tente novamente.')
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-6" role="status" aria-live="polite">
        <div
          className={`flex size-12 items-center justify-center rounded-full ${
            status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
          }`}
        >
          {status === 'loading' && <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />}
          {status === 'ready' && <MailCheck className="size-6" aria-hidden="true" />}
          {status === 'success' && <CheckCircle2 className="size-6" aria-hidden="true" />}
          {status === 'error' && <MailWarning className="size-6" aria-hidden="true" />}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-3xl text-foreground">
            {status === 'loading'
              ? 'Confirmando e-mail'
              : status === 'ready'
                ? 'Confirme seu e-mail'
              : status === 'success'
                ? 'E-mail confirmado'
                : 'Link inválido'}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
        </div>
        {(status === 'ready' || canRetry) && (
          <Button type="button" size="lg" className="w-full" onClick={() => void verify()}>
            {canRetry ? 'Tentar novamente' : 'Confirmar meu e-mail'}
          </Button>
        )}
        {status !== 'loading' && status !== 'ready' && !canRetry && (
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="w-full">
            Ir para o login
          </Button>
        )}
      </div>
    </AuthShell>
  )
}
