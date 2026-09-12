'use client'

import { type FormEvent, useState } from 'react'
import { Clock, LoaderCircle, Pencil, Plus, Scissors } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/format'
import { serviceCategoryLabels, type AdminService, type Service } from '@/lib/types'

interface ApiResponse {
  service?: AdminService
  message?: string
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
  const [formKey, setFormKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function startCreating() {
    setEditing(null)
    setFormKey((current) => current + 1)
  }

  function startEditing(service: AdminService) {
    setEditing(service)
    setFormKey((current) => current + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setIsSubmitting(true)

    try {
      const response = await fetch(
        editing ? `/api/admin/services/${encodeURIComponent(editing.id)}` : '/api/admin/services',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: data.get('name'),
            description: data.get('description'),
            durationMinutes: data.get('durationMinutes'),
            price: data.get('price'),
            category: data.get('category'),
            isActive: data.get('isActive') === 'on',
          }),
        },
      )
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.service) {
        toast.error(result?.message ?? 'Não foi possível salvar o serviço.')
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
      setFormKey((current) => current + 1)
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(320px,400px)_1fr] xl:items-start">
      <Card>
        <CardContent>
          <form key={formKey} className="flex flex-col gap-5" onSubmit={saveService}>
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

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Nome
              <Input name="name" defaultValue={editing?.name ?? ''} minLength={2} maxLength={100} required />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Descrição
              <Textarea
                name="description"
                defaultValue={editing?.description ?? ''}
                minLength={3}
                maxLength={255}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Duração (min)
                <Input
                  name="durationMinutes"
                  type="number"
                  min={5}
                  max={240}
                  step={5}
                  defaultValue={editing?.durationMinutes ?? 30}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Preço (R$)
                <Input
                  name="price"
                  type="number"
                  min="0.01"
                  max="9999.99"
                  step="0.01"
                  defaultValue={editing?.price ?? ''}
                  required
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Categoria
              <select
                name="category"
                defaultValue={editing?.category ?? 'cortes'}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                required
              >
                {(Object.keys(serviceCategoryLabels) as Service['category'][]).map((category) => (
                  <option key={category} value={category}>
                    {serviceCategoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                name="isActive"
                type="checkbox"
                defaultChecked={editing?.isActive ?? true}
                className="size-4 accent-primary"
              />
              Serviço disponível para agendamento
            </label>

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
