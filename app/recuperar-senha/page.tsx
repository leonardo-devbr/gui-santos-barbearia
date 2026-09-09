'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { isValidEmail, normalizeEmail } from '@/lib/validation'

interface RecoveryResponse {
  message?: string
}

export default function RecoverPasswordPage() {
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const email = normalizeEmail(String(new FormData(event.currentTarget).get('email') ?? ''))

    if (!isValidEmail(email)) {
      setEmailError('Informe um e-mail válido.')
      setSubmitError(null)
      return
    }

    setEmailError(null)
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = (await response.json().catch(() => null)) as RecoveryResponse | null

      if (!response.ok) {
        setSubmitError(result?.message ?? 'Não foi possível enviar as instruções. Tente novamente mais tarde.')
        return
      }

      setIsSent(true)
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
      {isSent ? (
        <div className="flex flex-col gap-6" role="status">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-3xl text-foreground">Verifique seu e-mail</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Se houver uma conta vinculada ao endereço informado, você receberá as instruções para redefinir sua senha.
            </p>
          </div>
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="w-full">
            Voltar para o login
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-3xl text-foreground">Recuperar senha</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Informe seu e-mail para receber as instruções de recuperação.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate aria-busy={isSubmitting}>
            <FieldGroup>
              <Field data-invalid={Boolean(emailError)}>
                <FieldLabel htmlFor="recovery-email">E-mail</FieldLabel>
                <Input
                  id="recovery-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="voce@email.com"
                  maxLength={254}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'recovery-email-error' : undefined}
                  onValueChange={() => {
                    setEmailError(null)
                    setSubmitError(null)
                  }}
                  required
                />
                <FieldError id="recovery-email-error">{emailError}</FieldError>
              </Field>
            </FieldGroup>

            {submitError && (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {submitError}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {isSubmitting ? 'Enviando...' : 'Enviar instruções'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Lembrou sua senha?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Voltar para o login
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  )
}
