
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AuthShell } from '@/components/auth-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'

type SignupField = 'name' | 'phone' | 'email' | 'password' | 'passwordConfirmation'

type SignupErrors = Partial<Record<SignupField, string>>

interface SignupResponse {
  message?: string
  errors?: SignupErrors
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function validateSignup(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ')
  const phone = String(formData.get('phone') ?? '').replace(/\D/g, '')
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const passwordConfirmation = String(formData.get('passwordConfirmation') ?? '')
  const errors: SignupErrors = {}

  if (name.length < 3) {
    errors.name = 'Informe seu nome completo.'
  } else if (name.length > 80) {
    errors.name = 'O nome deve ter no máximo 80 caracteres.'
  }

  if (phone.length < 10 || phone.length > 11) {
    errors.phone = 'Informe um telefone com DDD.'
  }

  if (!emailPattern.test(email)) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (password.length < 8 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use ao menos 8 caracteres, incluindo uma letra e um número.'
  }

  if (!passwordConfirmation) {
    errors.passwordConfirmation = 'Confirme sua senha.'
  } else if (passwordConfirmation !== password) {
    errors.passwordConfirmation = 'As senhas não coincidem.'
  }

  return {
    data: { name, phone, email, password },
    errors,
  }
}

export default function SignupPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<SignupErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearError(field: SignupField) {
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

    const { data, errors: validationErrors } = validateSignup(new FormData(event.currentTarget))

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = (await response.json().catch(() => null)) as SignupResponse | null

      if (!response.ok) {
        if (result?.errors) setErrors(result.errors)
        setSubmitError(result?.message ?? 'Não foi possível criar sua conta. Tente novamente mais tarde.')
        return
      }

      toast.success('Conta criada com sucesso. Faça login para continuar.')
      router.replace('/login')
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl text-foreground">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Cadastre-se para agendar seus horários.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="name">Nome completo</FieldLabel>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Seu nome"
              maxLength={80}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              onChange={() => clearError('name')}
              required
            />
            <FieldError id="name-error">{errors.name}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.phone)}>
            <FieldLabel htmlFor="phone">Telefone</FieldLabel>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(11) 90000-0000"
              value={phone}
              maxLength={15}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
              onValueChange={(value) => {
                setPhone(formatPhone(value))
                clearError('phone')
              }}
              required
            />
            <FieldError id="phone-error">{errors.phone}</FieldError>
          </Field>
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
              aria-describedby={errors.email ? 'email-error' : undefined}
              onChange={() => clearError('email')}
              required
            />
            <FieldError id="email-error">{errors.email}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.password)}>
            <FieldLabel htmlFor="password">Senha</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : 'password-description'}
              onChange={() => clearError('password')}
              required
            />
            {!errors.password && (
              <FieldDescription id="password-description">
                Use ao menos 8 caracteres, incluindo uma letra e um número.
              </FieldDescription>
            )}
            <FieldError id="password-error">{errors.password}</FieldError>
          </Field>
          <Field data-invalid={Boolean(errors.passwordConfirmation)}>
            <FieldLabel htmlFor="passwordConfirmation">Confirmar senha</FieldLabel>
            <Input
              id="passwordConfirmation"
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              placeholder="Digite a senha novamente"
              minLength={8}
              aria-invalid={Boolean(errors.passwordConfirmation)}
              aria-describedby={errors.passwordConfirmation ? 'password-confirmation-error' : undefined}
              onChange={() => clearError('passwordConfirmation')}
              required
            />
            <FieldError id="password-confirmation-error">{errors.passwordConfirmation}</FieldError>
          </Field>
        </FieldGroup>

        {submitError && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {submitError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  )
}
