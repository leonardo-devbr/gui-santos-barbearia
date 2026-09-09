'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import type { CustomerProfile } from '@/lib/types'

type ProfileField = 'name' | 'phone' | 'email' | 'birthDate' | 'preferredCut' | 'beardStyle' | 'notes'

type ProfileErrors = Partial<Record<ProfileField, string>>

interface ProfileResponse {
  message?: string
  errors?: ProfileErrors
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

export function ProfileForm({ customer }: { customer: CustomerProfile }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    birthDate: customer.birthDate,
    preferredCut: customer.preferredCut,
    beardStyle: customer.beardStyle,
    notes: customer.notes,
  })
  const [errors, setErrors] = useState<ProfileErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
    setSubmitError(null)
  }

  function validate() {
    const validationErrors: ProfileErrors = {}
    const phoneDigits = form.phone.replace(/\D/g, '')
    const today = new Date().toISOString().slice(0, 10)

    if (form.name.trim().length < 3) validationErrors.name = 'Informe seu nome completo.'
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      validationErrors.phone = 'Informe um telefone com DDD.'
    }
    if (!emailPattern.test(form.email.trim())) validationErrors.email = 'Informe um e-mail válido.'
    if (form.birthDate && form.birthDate > today) {
      validationErrors.birthDate = 'A data de nascimento não pode estar no futuro.'
    }
    if (form.preferredCut.length > 100) {
      validationErrors.preferredCut = 'Use no máximo 100 caracteres.'
    }
    if (form.beardStyle.length > 100) {
      validationErrors.beardStyle = 'Use no máximo 100 caracteres.'
    }
    if (form.notes.length > 500) validationErrors.notes = 'Use no máximo 500 caracteres.'

    return validationErrors
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/customers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          name: form.name.trim().replace(/\s+/g, ' '),
          phone: form.phone.replace(/\D/g, ''),
          email: form.email.trim().toLowerCase(),
          preferredCut: form.preferredCut.trim(),
          beardStyle: form.beardStyle.trim(),
          notes: form.notes.trim(),
        }),
      })
      const result = (await response.json().catch(() => null)) as ProfileResponse | null

      if (!response.ok) {
        if (result?.errors) setErrors(result.errors)
        setSubmitError(result?.message ?? 'Não foi possível salvar suas informações. Tente novamente.')
        return
      }

      toast.success('Perfil atualizado', {
        description: 'Suas informações foram salvas com sucesso.',
      })
      router.refresh()
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate aria-busy={isSubmitting}>
      <Card>
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-serif text-lg text-card-foreground">Dados pessoais</h2>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="name">Nome completo</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                value={form.name}
                maxLength={80}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'profile-name-error' : undefined}
                onValueChange={(value) => update('name', value)}
                required
              />
              <FieldError id="profile-name-error">{errors.name}</FieldError>
            </Field>
            <Field orientation="responsive">
              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor="phone">Telefone</FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  maxLength={15}
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? 'profile-phone-error' : undefined}
                  onValueChange={(value) => update('phone', formatPhone(value))}
                  required
                />
                <FieldError id="profile-phone-error">{errors.phone}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.birthDate)}>
                <FieldLabel htmlFor="birthDate">Data de nascimento</FieldLabel>
                <Input
                  id="birthDate"
                  name="birthDate"
                  type="date"
                  autoComplete="bday"
                  value={form.birthDate}
                  aria-invalid={Boolean(errors.birthDate)}
                  aria-describedby={errors.birthDate ? 'profile-birth-date-error' : undefined}
                  onValueChange={(value) => update('birthDate', value)}
                />
                <FieldError id="profile-birth-date-error">{errors.birthDate}</FieldError>
              </Field>
            </Field>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                maxLength={254}
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'profile-email-error' : undefined}
                onValueChange={(value) => update('email', value)}
                required
              />
              <FieldError id="profile-email-error">{errors.email}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <h2 className="font-serif text-lg text-card-foreground">Preferências de atendimento</h2>
          <FieldGroup>
            <Field orientation="responsive">
              <Field data-invalid={Boolean(errors.preferredCut)}>
                <FieldLabel htmlFor="preferredCut">Corte preferido</FieldLabel>
                <Input
                  id="preferredCut"
                  name="preferredCut"
                  value={form.preferredCut}
                  maxLength={100}
                  aria-invalid={Boolean(errors.preferredCut)}
                  aria-describedby={errors.preferredCut ? 'profile-preferred-cut-error' : undefined}
                  onValueChange={(value) => update('preferredCut', value)}
                />
                <FieldError id="profile-preferred-cut-error">{errors.preferredCut}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.beardStyle)}>
                <FieldLabel htmlFor="beardStyle">Estilo de barba</FieldLabel>
                <Input
                  id="beardStyle"
                  name="beardStyle"
                  value={form.beardStyle}
                  maxLength={100}
                  aria-invalid={Boolean(errors.beardStyle)}
                  aria-describedby={errors.beardStyle ? 'profile-beard-style-error' : undefined}
                  onValueChange={(value) => update('beardStyle', value)}
                />
                <FieldError id="profile-beard-style-error">{errors.beardStyle}</FieldError>
              </Field>
            </Field>
            <Field data-invalid={Boolean(errors.notes)}>
              <FieldLabel htmlFor="notes">Observações</FieldLabel>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                value={form.notes}
                maxLength={500}
                aria-invalid={Boolean(errors.notes)}
                aria-describedby={errors.notes ? 'profile-notes-error' : undefined}
                onChange={(event) => update('notes', event.target.value)}
                placeholder="Preferências, alergias ou observações para o barbeiro."
              />
              <FieldError id="profile-notes-error">{errors.notes}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {submitError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}
