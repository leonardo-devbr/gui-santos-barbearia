'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { KeyRound, LoaderCircle, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Textarea } from '@/components/ui/textarea'
import {
  type BarberProfileErrors,
  type BarberProfileField,
  validateBarberProfileForm,
} from '@/lib/barber-profile-validation'
import type { BarberProfile } from '@/lib/types'
import { formatPhone } from '@/lib/validation'

interface ProfileResponse {
  profile?: BarberProfile
  passwordChanged?: boolean
  message?: string
  errors?: BarberProfileErrors
}

export function BarberProfileForm({ profile }: { profile: BarberProfile }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: profile.name,
    phone: formatPhone(profile.phone),
    specialty: profile.specialty,
    bio: profile.bio,
    currentPassword: '',
    newPassword: '',
    passwordConfirmation: '',
  })
  const [errors, setErrors] = useState<BarberProfileErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function update(field: BarberProfileField, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
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
    const validation = validateBarberProfileForm(form)
    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors)
      setSubmitError('Revise os campos destacados para continuar.')
      return
    }

    setErrors({})
    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validation.data),
      })
      const result = (await response.json().catch(() => null)) as ProfileResponse | null
      if (!response.ok || !result?.profile) {
        if (result?.errors) setErrors(result.errors)
        setSubmitError(result?.message ?? 'Não foi possível salvar seu perfil. Tente novamente.')
        return
      }

      setForm((current) => ({
        ...current,
        name: result.profile!.name,
        phone: formatPhone(result.profile!.phone),
        specialty: result.profile!.specialty,
        bio: result.profile!.bio,
        currentPassword: '',
        newPassword: '',
        passwordConfirmation: '',
      }))
      toast.success(result.passwordChanged ? 'Perfil e senha atualizados' : 'Perfil atualizado', {
        description: result.message,
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
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative size-24 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
              <Image
                src={profile.photoUrl}
                alt={`Foto de ${profile.name}`}
                fill
                className="object-cover"
                style={{ objectPosition: `${profile.photoPositionX}% ${profile.photoPositionY}%` }}
              />
            </div>
            <div>
              <h2 className="font-serif text-xl text-card-foreground">Perfil profissional</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Essas informações ficam visíveis para os clientes no site e no aplicativo.
              </p>
            </div>
          </div>

          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="barber-profile-name">Nome de exibição</FieldLabel>
              <Input
                id="barber-profile-name"
                name="name"
                autoComplete="name"
                value={form.name}
                minLength={3}
                maxLength={80}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'barber-profile-name-error' : undefined}
                onValueChange={(value) => update('name', value)}
                required
              />
              <FieldError id="barber-profile-name-error">{errors.name}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="barber-profile-phone">Telefone para clientes (opcional)</FieldLabel>
              <Input
                id="barber-profile-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone}
                maxLength={15}
                placeholder="(15) 99999-9999"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'barber-profile-phone-error' : 'barber-profile-phone-help'}
                onValueChange={(value) => update('phone', formatPhone(value))}
              />
              {!errors.phone && (
                <p id="barber-profile-phone-help" className="text-xs text-muted-foreground">
                  Quando preenchido, o contato aparece no seu perfil público.
                </p>
              )}
              <FieldError id="barber-profile-phone-error">{errors.phone}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.specialty)}>
              <FieldLabel htmlFor="barber-profile-specialty">Especialidade</FieldLabel>
              <Input
                id="barber-profile-specialty"
                name="specialty"
                value={form.specialty}
                minLength={3}
                maxLength={160}
                aria-invalid={Boolean(errors.specialty)}
                aria-describedby={errors.specialty ? 'barber-profile-specialty-error' : undefined}
                onValueChange={(value) => update('specialty', value)}
                required
              />
              <FieldError id="barber-profile-specialty-error">{errors.specialty}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.bio)}>
              <FieldLabel htmlFor="barber-profile-bio">Apresentação</FieldLabel>
              <Textarea
                id="barber-profile-bio"
                name="bio"
                rows={4}
                value={form.bio}
                minLength={3}
                maxLength={500}
                aria-invalid={Boolean(errors.bio)}
                aria-describedby={errors.bio ? 'barber-profile-bio-error' : undefined}
                onChange={(event) => update('bio', event.target.value)}
                required
              />
              <FieldError id="barber-profile-bio-error">{errors.bio}</FieldError>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-serif text-xl text-card-foreground">Acesso ao painel</h2>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Para manter a senha atual, deixe os três campos abaixo em branco.
          </p>

          <FieldGroup>
            <Field data-invalid={Boolean(errors.currentPassword)}>
              <FieldLabel htmlFor="barber-current-password">Senha atual</FieldLabel>
              <PasswordInput
                id="barber-current-password"
                name="currentPassword"
                autoComplete="current-password"
                value={form.currentPassword}
                maxLength={128}
                placeholder="Confirme sua senha atual"
                aria-invalid={Boolean(errors.currentPassword)}
                aria-describedby={errors.currentPassword ? 'barber-current-password-error' : undefined}
                onValueChange={(value) => update('currentPassword', value)}
              />
              <FieldError id="barber-current-password-error">{errors.currentPassword}</FieldError>
            </Field>

            <Field orientation="responsive">
              <Field data-invalid={Boolean(errors.newPassword)}>
                <FieldLabel htmlFor="barber-new-password">Nova senha</FieldLabel>
                <PasswordInput
                  id="barber-new-password"
                  name="newPassword"
                  autoComplete="new-password"
                  value={form.newPassword}
                  minLength={12}
                  maxLength={128}
                  placeholder="Mínimo de 12 caracteres"
                  aria-invalid={Boolean(errors.newPassword)}
                  aria-describedby={errors.newPassword ? 'barber-new-password-error' : 'barber-new-password-help'}
                  onValueChange={(value) => update('newPassword', value)}
                />
                {!errors.newPassword && (
                  <p id="barber-new-password-help" className="text-xs text-muted-foreground">
                    Use ao menos 12 caracteres, uma letra e um número.
                  </p>
                )}
                <FieldError id="barber-new-password-error">{errors.newPassword}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.passwordConfirmation)}>
                <FieldLabel htmlFor="barber-password-confirmation">Confirmar nova senha</FieldLabel>
                <PasswordInput
                  id="barber-password-confirmation"
                  name="passwordConfirmation"
                  autoComplete="new-password"
                  value={form.passwordConfirmation}
                  minLength={12}
                  maxLength={128}
                  placeholder="Repita a nova senha"
                  aria-invalid={Boolean(errors.passwordConfirmation)}
                  aria-describedby={
                    errors.passwordConfirmation ? 'barber-password-confirmation-error' : undefined
                  }
                  onValueChange={(value) => update('passwordConfirmation', value)}
                />
                <FieldError id="barber-password-confirmation-error">
                  {errors.passwordConfirmation}
                </FieldError>
              </Field>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {submitError && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save />}
          {isSubmitting ? 'Salvando...' : 'Salvar perfil'}
        </Button>
      </div>
    </form>
  )
}
