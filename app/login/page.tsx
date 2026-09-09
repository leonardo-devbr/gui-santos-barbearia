'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'

type LoginField = 'email' | 'password'

type LoginErrors = Partial<Record<LoginField, string>>

interface LoginResponse {
  message?: string
  errors?: LoginErrors
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateLogin(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const errors: LoginErrors = {}

  if (!emailPattern.test(email)) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (!password) {
    errors.password = 'Informe sua senha.'
  }

  return { data: { email, password }, errors }
}

export default function LoginPage() {
  const router = useRouter()
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearError(field: LoginField) {
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

    const { data, errors: validationErrors } = validateLogin(new FormData(event.currentTarget))

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })
      const result = (await response.json().catch(() => null)) as LoginResponse | null

      if (!response.ok) {
        if (result?.errors) setErrors(result.errors)
        setSubmitError(result?.message ?? 'Não foi possível entrar. Confira seus dados e tente novamente.')
        return
      }

      toast.success('Login realizado com sucesso.')
      router.replace('/app')
      router.refresh()
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl text-foreground">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground">Entre para agendar seu próximo horário.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate aria-busy={isSubmitting}>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.email)}>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="voce@email.com"
              maxLength={254}
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              onValueChange={() => clearError('email')}
              required
            />
            <FieldError id="login-email-error">{errors.email}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.password)}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Link href="/recuperar-senha" className="text-xs text-primary hover:underline">
                Esqueceu a senha?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              onValueChange={() => clearError('password')}
              required
            />
            <FieldError id="login-password-error">{errors.password}</FieldError>
          </Field>
        </FieldGroup>

        {submitError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link href="/cadastro" className="font-medium text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  )
}
