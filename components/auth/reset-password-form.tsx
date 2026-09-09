'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { getPasswordError, MAX_PASSWORD_LENGTH } from '@/lib/validation'

type ResetPasswordField = 'password' | 'passwordConfirmation'
type ResetPasswordErrors = Partial<Record<ResetPasswordField, string>>

interface ResetPasswordResponse {
  message?: string
  errors?: ResetPasswordErrors
}

function validatePasswords(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const passwordConfirmation = String(formData.get('passwordConfirmation') ?? '')
  const errors: ResetPasswordErrors = {}

  const passwordError = getPasswordError(password)
  if (passwordError) errors.password = passwordError

  if (!passwordConfirmation) {
    errors.passwordConfirmation = 'Confirme sua nova senha.'
  } else if (passwordConfirmation !== password) {
    errors.passwordConfirmation = 'As senhas não coincidem.'
  }

  return { password, errors }
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [errors, setErrors] = useState<ResetPasswordErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  function clearError(field: ResetPasswordField) {
    setErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
    setSubmitError(null)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token || isSubmitting) return

    const { password, errors: validationErrors } = validatePasswords(new FormData(event.currentTarget))

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const result = (await response.json().catch(() => null)) as ResetPasswordResponse | null

      if (!response.ok) {
        if (result?.errors) setErrors(result.errors)
        setSubmitError(result?.message ?? 'Não foi possível redefinir sua senha. Solicite um novo link e tente novamente.')
        return
      }

      setIsCompleted(true)
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-6">
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <KeyRound className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-3xl text-foreground">Link inválido</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Este link não contém um token de recuperação. Solicite novas instruções para continuar.
            </p>
          </div>
          <Button render={<Link href="/recuperar-senha" />} nativeButton={false} size="lg" className="w-full">
            Solicitar novo link
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (isCompleted) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-6" role="status">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-3xl text-foreground">Senha redefinida</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sua nova senha já pode ser usada para acessar a área do cliente.
            </p>
          </div>
          <Button render={<Link href="/login" />} nativeButton={false} size="lg" className="w-full">
            Entrar
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl text-foreground">Crie uma nova senha</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Escolha uma senha diferente da anterior para proteger sua conta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate aria-busy={isSubmitting}>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.password)}>
            <FieldLabel htmlFor="new-password">Nova senha</FieldLabel>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={MAX_PASSWORD_LENGTH}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'new-password-error' : 'new-password-description'}
              onValueChange={() => clearError('password')}
              required
            />
            {!errors.password && (
              <FieldDescription id="new-password-description">
                Use ao menos 8 caracteres, incluindo uma letra e um número.
              </FieldDescription>
            )}
            <FieldError id="new-password-error">{errors.password}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.passwordConfirmation)}>
            <FieldLabel htmlFor="new-password-confirmation">Confirmar nova senha</FieldLabel>
            <Input
              id="new-password-confirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={MAX_PASSWORD_LENGTH}
              aria-invalid={Boolean(errors.passwordConfirmation)}
              aria-describedby={errors.passwordConfirmation ? 'new-password-confirmation-error' : undefined}
              onValueChange={() => clearError('passwordConfirmation')}
              required
            />
            <FieldError id="new-password-confirmation-error">{errors.passwordConfirmation}</FieldError>
          </Field>
        </FieldGroup>

        {submitError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Redefinindo...' : 'Redefinir senha'}
        </Button>
      </form>
    </AuthShell>
  )
}
