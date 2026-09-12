'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { isValidEmail, normalizeEmail } from '@/lib/validation'

interface LoginResponse {
  message?: string
}

export function AdminLoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = normalizeEmail(String(formData.get('email') ?? ''))
    const password = String(formData.get('password') ?? '')

    if (!isValidEmail(email) || !password) {
      setError('Informe seu e-mail e senha para continuar.')
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const result = (await response.json().catch(() => null)) as LoginResponse | null

      if (!response.ok) {
        setError(result?.message ?? 'Não foi possível acessar o painel.')
        return
      }

      router.replace('/admin')
      router.refresh()
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="admin-email">E-mail administrativo</FieldLabel>
          <Input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="admin@barbearia.com"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-password">Senha</FieldLabel>
          <PasswordInput
            id="admin-password"
            name="password"
            autoComplete="current-password"
            required
          />
        </Field>
      </FieldGroup>

      {error && (
        <FieldError role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          {error}
        </FieldError>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Entrando...' : 'Entrar no painel'}
      </Button>
    </form>
  )
}
