'use client'

import { type FormEvent, useState } from 'react'
import { Clock, LoaderCircle, Pencil, Plus, Scissors } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  formatBRLCurrencyInput,
  formatBRLCurrencyValue,
  type AdminServiceFormErrors,
  type AdminServiceFormField,
  validateAdminServiceForm,
} from '@/lib/admin-form-validation'
import { formatPrice } from '@/lib/format'
import { serviceCategoryLabels, type AdminService, type Service } from '@/lib/types'

interface ApiResponse {
  service?: AdminService
  message?: string
  errors?: AdminServiceFormErrors
}

function sortServices(services: AdminService[]) {
  return [...services].sort((left, right) => {
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1
    return left.name.localeCompare(right.name, 'pt-BR')
  })
}

export function AdminServicesManager({ initial }: { initial: AdminService[] }) {
  const [services, setServices] = useState(initial)
  const [editing, setEditing] = useState<AdminService | null>(null)
  const [price, setPrice] = useState('')
  const [errors, setErrors] = useState<AdminServiceFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function clearError(field: AdminServiceFormField) {
    setErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
    setSubmitError(null)
  }

  function startCreating() {
    setEditing(null)
    setPrice('')
    setErrors({})
    setSubmitError(null)
    setFormKey((current) => current + 1)
  }

  function startEditing(service: AdminService) {
    setEditing(service)
    setPrice(formatBRLCurrencyValue(service.price))
    setErrors({})
    setSubmitError(null)
    setFormKey((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const validation = validateAdminServiceForm({
      name: String(data.get('name') ?? ''),
      description: String(data.get('description') ?? ''),
      durationMinutes: String(data.get('durationMinutes') ?? ''),
      price,
      category: String(data.get('category') ?? ''),
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
      const response = await fetch(
        editing ? `/api/admin/services/${encodeURIComponent(editing.id)}` : '/api/admin/services',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...validation.data,
            isActive: data.get('isActive') === 'on',
          }),
        },
      )
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.service) {
        if (result?.errors) setErrors(result.errors)
        setSubmitError(result?.message ?? 'Não foi possível salvar o serviço. Tente novamente.')
        return
      }

      setServices((current) =>
        sortServices(
          editing
            ? current.map((service) => (service.id === result.service!.id ? result.service! : service))
            : [...current, result.service!],
        ),
      )
      toast.success(editing ? 'Serviço atualizado.' : 'Serviço criado.')
      setEditing(null)
      setPrice('')
      setErrors({})
      setSubmitError(null)
      setFormKey((current) => current + 1)
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(320px,400px)_1fr] xl:items-start">
      <Card>
        <CardContent>
          <form
            key={formKey}
            className="flex flex-col gap-5"
            onSubmit={saveService}
            noValidate
            aria-busy={isSubmitting}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-card-foreground">
                  {editing ? 'Editar serviço' : 'Novo serviço'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Alterações ficam disponíveis no agendamento imediatamente.
                </p>
              </div>
              {editing && (
                <Button type="button" size="sm" variant="ghost" onClick={startCreating}>
                  <Plus /> Novo
                </Button>
              )}
            </div>

            <FieldGroup>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="service-name">Nome</FieldLabel>
                <Input
                  id="service-name"
                  name="name"
                  defaultValue={editing?.name ?? ''}
                  minLength={2}
                  maxLength={100}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'service-name-error' : undefined}
                  onValueChange={() => clearError('name')}
                  required
                />
                <FieldError id="service-name-error">{errors.name}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="service-description">Descrição</FieldLabel>
                <Textarea
                  id="service-description"
                  name="description"
                  defaultValue={editing?.description ?? ''}
                  minLength={3}
                  maxLength={255}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? 'service-description-error' : undefined}
                  onChange={() => clearError('description')}
                  required
                />
                <FieldError id="service-description-error">{errors.description}</FieldError>
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.durationMinutes)}>
                  <FieldLabel htmlFor="service-duration">Duração (min)</FieldLabel>
                  <Input
                    id="service-duration"
                    name="durationMinutes"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={240}
                    step={5}
                    defaultValue={editing?.durationMinutes ?? 30}
                    aria-invalid={Boolean(errors.durationMinutes)}
                    aria-describedby={
                      errors.durationMinutes ? 'service-duration-error' : undefined
                    }
                    onValueChange={() => clearError('durationMinutes')}
                    required
                  />
                  <FieldError id="service-duration-error">{errors.durationMinutes}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.price)}>
                  <FieldLabel htmlFor="service-price">Preço</FieldLabel>
                  <Input
                    id="service-price"
                    name="price"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="R$ 0,00"
                    value={price}
                    maxLength={15}
                    aria-invalid={Boolean(errors.price)}
                    aria-describedby={errors.price ? 'service-price-error' : 'service-price-help'}
                    onValueChange={(value) => {
                      setPrice(formatBRLCurrencyInput(value))
                      clearError('price')
                    }}
                    required
                  />
                  {!errors.price && (
                    <p id="service-price-help" className="text-xs font-normal text-muted-foreground">
                      Digite apenas os números; os centavos e o símbolo de real são aplicados automaticamente.
                    </p>
                  )}
                  <FieldError id="service-price-error">{errors.price}</FieldError>
                </Field>
              </div>

              <Field data-invalid={Boolean(errors.category)}>
                <FieldLabel htmlFor="service-category">Categoria</FieldLabel>
                <select
                  id="service-category"
                  name="category"
                  defaultValue={editing?.category ?? 'cortes'}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
                  aria-invalid={Boolean(errors.category)}
                  aria-describedby={errors.category ? 'service-category-error' : undefined}
                  onChange={() => clearError('category')}
                  required
                >
                  {(Object.keys(serviceCategoryLabels) as Service['category'][]).map((category) => (
                    <option key={category} value={category}>
                      {serviceCategoryLabels[category]}
                    </option>
                  ))}
                </select>
                <FieldError id="service-category-error">{errors.category}</FieldError>
              </Field>
            </FieldGroup>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={editing?.isActive ?? true}
                className="size-4 accent-primary"
              />
              Serviço disponível para agendamento
            </label>

            {submitError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {submitError}
              </p>
            )}

            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Scissors />}
              {isSubmitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar serviço'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Serviços cadastrados</h2>
          <p className="text-sm text-muted-foreground">{services.length} serviço(s) no catálogo.</p>
        </div>

        <div className="flex flex-col gap-3">
          {services.map((service) => (
            <Card key={service.id} className={!service.isActive ? 'opacity-65' : undefined}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-lg text-card-foreground">{service.name}</span>
                    <Badge variant={service.isActive ? 'secondary' : 'outline'}>
                      {service.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Badge variant="outline">{serviceCategoryLabels[service.category]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4 text-primary" /> {service.durationMinutes} min
                    </span>
                    <span className="font-medium text-primary">{formatPrice(service.price)}</span>
                  </div>
                </div>

                <Button type="button" variant="outline" onClick={() => startEditing(service)}>
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
