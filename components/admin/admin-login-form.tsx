'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import {
  getApiMessage,
  type AdminLoginFormErrors,
  type AdminLoginFormField,
  validateAdminLoginForm,
} from '@/lib/admin-settings-form-validation'

interface LoginResponse {
  message?: string
}

export function AdminLoginForm() {
  const router = useRouter()
  const [errors, setErrors] = useState<AdminLoginFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearError(field: AdminLoginFormField) {
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
    const formData = new FormData(event.currentTarget)
    const validation = validateAdminLoginForm({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    })

    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors)
      setSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validation.data),
      })
      const result = (await response.json().catch(() => null)) as LoginResponse | null

      if (!response.ok) {
        setSubmitError(getApiMessage(result, 'Não foi possível acessar o painel. Tente novamente.'))
        return
      }

      router.replace('/admin')
      router.refresh()
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
      noValidate
      aria-busy={isSubmitting}
    >
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="admin-email">E-mail da equipe</FieldLabel>
          <Input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="admin@barbearia.com"
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'admin-email-error' : undefined}
            onValueChange={() => clearError('email')}
            required
          />
          <FieldError id="admin-email-error">{errors.email}</FieldError>
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="admin-password">Senha</FieldLabel>
          <PasswordInput
            id="admin-password"
            name="password"
            autoComplete="current-password"
            placeholder="Digite sua senha"
            maxLength={128}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'admin-password-error' : undefined}
            onValueChange={() => clearError('password')}
            required
          />
          <FieldError id="admin-password-error">{errors.password}</FieldError>
        </Field>
      </FieldGroup>

      {submitError && (
        <FieldError role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          {submitError}
        </FieldError>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Entrando...' : 'Entrar no painel da equipe'}
      </Button>
    </form>
  )
}
