'use client'

import Image from 'next/image'
import { type FormEvent, useEffect, useState } from 'react'
import { ImageUp, LoaderCircle, Pencil, Plus, Star, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  type AdminBarberFormErrors,
  type AdminBarberFormField,
  validateAdminBarberForm,
} from '@/lib/admin-barber-validation'
import { MAX_BARBER_PHOTO_BYTES } from '@/lib/barber-photo'
import type { AdminBarber } from '@/lib/types'
import { formatPhone } from '@/lib/validation'

interface ApiResponse {
  barber?: AdminBarber
  photoUrl?: string
  message?: string
  errors?: AdminBarberFormErrors
}

function sortBarbers(barbers: AdminBarber[]) {
  return [...barbers].sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
    return left.name.localeCompare(right.name, 'pt-BR')
  })
}

export function AdminBarbersManager({ initial }: { initial: AdminBarber[] }) {
  const [barbers, setBarbers] = useState(initial)
  const [editing, setEditing] = useState<AdminBarber | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoPositionX, setPhotoPositionX] = useState(50)
  const [photoPositionY, setPhotoPositionY] = useState(50)
  const [errors, setErrors] = useState<AdminBarberFormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    },
    [photoPreviewUrl],
  )

  function resetPhoto(barber?: AdminBarber) {
    setPhotoFile(null)
    setPhotoPreviewUrl(null)
    setPhotoPositionX(barber?.photoPositionX ?? 50)
    setPhotoPositionY(barber?.photoPositionY ?? 50)
    setErrors({})
    setFormError(null)
  }

  function clearError(field: AdminBarberFormField) {
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setFormError(null)
  }

  function startCreating() {
    setEditing(null)
    resetPhoto()
    setFormKey((current) => current + 1)
  }

  function startEditing(barber: AdminBarber) {
    setEditing(barber)
    resetPhoto(barber)
    setFormKey((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveBarber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const validation = validateAdminBarberForm({
      name: String(data.get('name') ?? ''),
      phone: String(data.get('phone') ?? ''),
      specialty: String(data.get('specialty') ?? ''),
      bio: String(data.get('bio') ?? ''),
      rating: String(data.get('rating') ?? ''),
      reviewCount: String(data.get('reviewCount') ?? ''),
    })
    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors)
      setFormError('Revise os campos destacados para continuar.')
      return
    }
    if (photoFile && photoFile.size > MAX_BARBER_PHOTO_BYTES) {
      setErrors({ photo: 'Escolha uma imagem de até 5 MB.' })
      setFormError('Escolha uma imagem de até 5 MB.')
      return
    }

    setErrors({})
    setFormError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch(
        editing ? `/api/admin/barbers/${encodeURIComponent(editing.id)}` : '/api/admin/barbers',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...validation.data,
            photoUrl: editing?.photoUrl ?? '/placeholder-user.jpg',
            photoPositionX,
            photoPositionY,
            isActive: data.get('isActive') === 'on',
          }),
        },
      )
      let result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.barber) {
        if (result?.errors) setErrors(result.errors)
        setFormError(result?.message ?? 'Não foi possível salvar o barbeiro.')
        return
      }

      if (photoFile) {
        const photoData = new FormData()
        photoData.set('photo', photoFile)
        const photoResponse = await fetch(
          `/api/admin/barbers/${encodeURIComponent(result.barber.id)}/photo`,
          { method: 'POST', credentials: 'include', body: photoData },
        )
        const photoResult = (await photoResponse.json().catch(() => null)) as ApiResponse | null
        if (!photoResponse.ok || !photoResult?.photoUrl) {
          setBarbers((current) =>
            sortBarbers(
              editing
                ? current.map((barber) =>
                    barber.id === result!.barber!.id ? result!.barber! : barber,
                  )
                : [...current, result!.barber!],
            ),
          )
          setEditing(result.barber)
          setErrors({ photo: photoResult?.message ?? 'Não foi possível importar a foto.' })
          setFormError(
            photoResult?.message ??
              'Os dados foram salvos, mas não foi possível importar a foto. Tente novamente.',
          )
          return
        }
        result = { ...result, barber: { ...result.barber, photoUrl: photoResult.photoUrl } }
      }

      setBarbers((current) =>
        sortBarbers(
          editing
            ? current.map((barber) => (barber.id === result.barber!.id ? result.barber! : barber))
            : [...current, result.barber!],
        ),
      )
      toast.success(editing ? 'Barbeiro atualizado.' : 'Barbeiro criado.')
      setEditing(null)
      resetPhoto()
      setFormKey((current) => current + 1)
    } catch {
      setFormError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(320px,420px)_1fr] xl:items-start">
      <Card>
        <CardContent>
          <form key={formKey} className="flex flex-col gap-5" onSubmit={saveBarber} noValidate>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-card-foreground">
                  {editing ? 'Editar barbeiro' : 'Novo barbeiro'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  O perfil ativo aparece no site e no agendamento.
                </p>
              </div>
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={startCreating}>
                  <Plus /> Novo
                </Button>
              )}
            </div>

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="admin-barber-name">Nome</FieldLabel>
              <Input
                id="admin-barber-name"
                name="name"
                defaultValue={editing?.name ?? ''}
                minLength={2}
                maxLength={100}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'admin-barber-name-error' : undefined}
                onValueChange={() => clearError('name')}
                required
              />
              <FieldError id="admin-barber-name-error">{errors.name}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.phone)}>
              <FieldLabel htmlFor="admin-barber-phone">Telefone para clientes (opcional)</FieldLabel>
              <Input
                id="admin-barber-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={formatPhone(editing?.phone ?? '')}
                maxLength={15}
                placeholder="(15) 99999-9999"
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'admin-barber-phone-error' : undefined}
                onChange={(event) => {
                  event.currentTarget.value = formatPhone(event.currentTarget.value)
                  clearError('phone')
                }}
              />
              <FieldError id="admin-barber-phone-error">{errors.phone}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.specialty)}>
              <FieldLabel htmlFor="admin-barber-specialty">Especialidade</FieldLabel>
              <Input
                id="admin-barber-specialty"
                name="specialty"
                defaultValue={editing?.specialty ?? ''}
                minLength={3}
                maxLength={160}
                aria-invalid={Boolean(errors.specialty)}
                aria-describedby={errors.specialty ? 'admin-barber-specialty-error' : undefined}
                onValueChange={() => clearError('specialty')}
                required
              />
              <FieldError id="admin-barber-specialty-error">{errors.specialty}</FieldError>
            </Field>

            <Field data-invalid={Boolean(errors.bio)}>
              <FieldLabel htmlFor="admin-barber-bio">Apresentação</FieldLabel>
              <Textarea
                id="admin-barber-bio"
                name="bio"
                defaultValue={editing?.bio ?? ''}
                minLength={3}
                maxLength={500}
                aria-invalid={Boolean(errors.bio)}
                aria-describedby={errors.bio ? 'admin-barber-bio-error' : undefined}
                onChange={() => clearError('bio')}
                required
              />
              <FieldError id="admin-barber-bio-error">{errors.bio}</FieldError>
            </Field>

            <fieldset
              className="flex flex-col gap-4 rounded-xl border border-border p-4"
              aria-invalid={Boolean(errors.photo)}
              aria-describedby={errors.photo ? 'admin-barber-photo-error' : undefined}
            >
              <legend className="px-1 text-sm font-medium">Foto de perfil</legend>
              <div className="grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center">
                <div className="relative mx-auto aspect-square w-full max-w-36 overflow-hidden rounded-full border border-border bg-muted">
                  <Image
                    src={photoPreviewUrl ?? editing?.photoUrl ?? '/placeholder-user.jpg'}
                    alt="Prévia da foto do barbeiro"
                    fill
                    unoptimized={Boolean(photoPreviewUrl)}
                    className="object-cover"
                    style={{ objectPosition: `${photoPositionX}% ${photoPositionY}%` }}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Input
                    key={`photo-${formKey}`}
                    id={`barber-photo-${formKey}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      if (file && file.size > MAX_BARBER_PHOTO_BYTES) {
                        event.target.value = ''
                        setPhotoFile(null)
                        setPhotoPreviewUrl(null)
                        setErrors({ photo: 'Escolha uma imagem de até 5 MB.' })
                        setFormError('Escolha uma imagem de até 5 MB.')
                        return
                      }
                      setPhotoFile(file)
                      setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
                      clearError('photo')
                    }}
                  />
                  <Button
                    render={<label htmlFor={`barber-photo-${formKey}`} />}
                    nativeButton={false}
                    type="button"
                    variant="outline"
                    className="w-fit cursor-pointer"
                  >
                    <ImageUp /> Importar foto
                  </Button>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    JPEG, PNG ou WebP de até 5 MB. Ajuste abaixo o enquadramento exibido no site.
                  </p>
                </div>
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Posição horizontal: {photoPositionX}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={photoPositionX}
                  className="accent-primary"
                  onChange={(event) => setPhotoPositionX(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                Posição vertical: {photoPositionY}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={photoPositionY}
                  className="accent-primary"
                  onChange={(event) => setPhotoPositionY(Number(event.target.value))}
                />
              </label>
              <FieldError id="admin-barber-photo-error">{errors.photo}</FieldError>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.rating)}>
                <FieldLabel htmlFor="admin-barber-rating">Avaliação</FieldLabel>
                <Input
                  id="admin-barber-rating"
                  name="rating"
                  type="number"
                  min={0}
                  max={5}
                  step="0.1"
                  defaultValue={editing?.rating ?? 5}
                  aria-invalid={Boolean(errors.rating)}
                  aria-describedby={errors.rating ? 'admin-barber-rating-error' : undefined}
                  onValueChange={() => clearError('rating')}
                  required
                />
                <FieldError id="admin-barber-rating-error">{errors.rating}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.reviewCount)}>
                <FieldLabel htmlFor="admin-barber-review-count">Nº de avaliações</FieldLabel>
                <Input
                  id="admin-barber-review-count"
                  name="reviewCount"
                  type="number"
                  min={0}
                  max={1_000_000}
                  step={1}
                  defaultValue={editing?.reviewCount ?? 0}
                  aria-invalid={Boolean(errors.reviewCount)}
                  aria-describedby={errors.reviewCount ? 'admin-barber-review-count-error' : undefined}
                  onValueChange={() => clearError('reviewCount')}
                  required
                />
                <FieldError id="admin-barber-review-count-error">{errors.reviewCount}</FieldError>
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={editing?.isActive ?? true}
                className="size-4 accent-primary"
              />
              Barbeiro disponível para agendamento
            </label>

            {formError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {formError}
              </p>
            )}

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <UserRound />}
              {isSubmitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar barbeiro'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Equipe cadastrada</h2>
          <p className="text-sm text-muted-foreground">{barbers.length} perfil(is) no painel.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {barbers.map((barber) => (
            <Card key={barber.id} className={!barber.isActive ? 'opacity-65' : undefined}>
              <CardContent className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    <Image
                      src={barber.photoUrl}
                      alt={barber.name}
                      fill
                      className="object-cover"
                      style={{ objectPosition: `${barber.photoPositionX}% ${barber.photoPositionY}%` }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-lg text-card-foreground">{barber.name}</span>
                      <Badge variant={barber.isActive ? 'secondary' : 'outline'}>
                        {barber.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{barber.specialty}</p>
                    {barber.phone && (
                      <p className="mt-1 text-xs text-muted-foreground">{formatPhone(barber.phone)}</p>
                    )}
                    <span className="mt-2 flex items-center gap-1 text-sm text-primary">
                      <Star className="size-4 fill-primary" /> {barber.rating.toFixed(1)} ·{' '}
                      {barber.reviewCount} avaliações
                    </span>
                  </div>
                </div>
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{barber.bio}</p>
                <Button type="button" variant="outline" onClick={() => startEditing(barber)}>
                  <Pencil /> Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
