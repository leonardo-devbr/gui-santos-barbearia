'use client'

import Image from 'next/image'
import { type FormEvent, useEffect, useState } from 'react'
import { ImageUp, LoaderCircle, Pencil, Plus, Star, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MAX_BARBER_PHOTO_BYTES } from '@/lib/barber-photo'
import type { AdminBarber } from '@/lib/types'

interface ApiResponse {
  barber?: AdminBarber
  photoUrl?: string
  message?: string
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
    if (photoFile && photoFile.size > MAX_BARBER_PHOTO_BYTES) {
      setFormError('Escolha uma imagem de até 5 MB.')
      return
    }

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
            name: data.get('name'),
            specialty: data.get('specialty'),
            bio: data.get('bio'),
            photoUrl: editing?.photoUrl ?? '/placeholder-user.jpg',
            photoPositionX,
            photoPositionY,
            rating: data.get('rating'),
            reviewCount: data.get('reviewCount'),
            isActive: data.get('isActive') === 'on',
          }),
        },
      )
      let result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.barber) {
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
          <form key={formKey} className="flex flex-col gap-5" onSubmit={saveBarber}>
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

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nome
              <Input name="name" defaultValue={editing?.name ?? ''} minLength={2} maxLength={100} required />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Especialidade
              <Input
                name="specialty"
                defaultValue={editing?.specialty ?? ''}
                minLength={3}
                maxLength={160}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Apresentação
              <Textarea
                name="bio"
                defaultValue={editing?.bio ?? ''}
                minLength={3}
                maxLength={500}
                required
              />
            </label>

            <fieldset className="flex flex-col gap-4 rounded-xl border border-border p-4">
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
                        setFormError('Escolha uma imagem de até 5 MB.')
                        return
                      }
                      setPhotoFile(file)
                      setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
                      setFormError(null)
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
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Avaliação
                <Input
                  name="rating"
                  type="number"
                  min={0}
                  max={5}
                  step="0.1"
                  defaultValue={editing?.rating ?? 5}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Nº de avaliações
                <Input
                  name="reviewCount"
                  type="number"
                  min={0}
                  max={1_000_000}
                  step={1}
                  defaultValue={editing?.reviewCount ?? 0}
                  required
                />
              </label>
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
