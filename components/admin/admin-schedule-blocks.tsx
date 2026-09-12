'use client'

import { type FormEvent, useState } from 'react'
import { CalendarOff, Clock, LoaderCircle, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { formatDateLong } from '@/lib/format'
import type { Barber, ScheduleBlock } from '@/lib/types'

interface ApiResponse {
  block?: ScheduleBlock
  message?: string
}

function sortBlocks(blocks: ScheduleBlock[]) {
  return [...blocks].sort((left, right) => {
    const leftValue = `${left.date}-${left.startTime ?? '00:00'}-${left.barberName}`
    const rightValue = `${right.date}-${right.startTime ?? '00:00'}-${right.barberName}`
    return leftValue.localeCompare(rightValue, 'pt-BR')
  })
}

export function AdminScheduleBlocks({
  initial,
  barbers,
  today,
}: {
  initial: ScheduleBlock[]
  barbers: Barber[]
  today: string
}) {
  const [blocks, setBlocks] = useState(initial)
  const [fullDay, setFullDay] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/schedule-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          barberId: data.get('barberId'),
          date: data.get('date'),
          fullDay,
          startTime: data.get('startTime'),
          endTime: data.get('endTime'),
          reason: data.get('reason'),
        }),
      })
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.block) {
        toast.error(result?.message ?? 'Não foi possível criar o bloqueio.')
        return
      }

      setBlocks((current) => sortBlocks([...current, result.block!]))
      form.reset()
      setFullDay(true)
      toast.success('Período bloqueado com sucesso.')
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function removeBlock(block: ScheduleBlock) {
    if (!window.confirm(`Remover o bloqueio “${block.reason}”?`)) return
    setDeletingId(block.id)

    try {
      const response = await fetch(`/api/admin/schedule-blocks/${encodeURIComponent(block.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        toast.error(result?.message ?? 'Não foi possível remover o bloqueio.')
        return
      }

      setBlocks((current) => current.filter((item) => item.id !== block.id))
      toast.success('Bloqueio removido.')
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(300px,380px)_1fr] xl:items-start">
      <Card>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={createBlock}>
            <div>
              <h2 className="font-serif text-xl text-card-foreground">Novo bloqueio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use para folgas, feriados, almoço ou compromissos.
              </p>
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
              Barbeiro
              <select
                name="barberId"
                required
                defaultValue="all"
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="all">Todos os barbeiros</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
              Data
              <Input name="date" type="date" min={today} defaultValue={today} required />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
              <input
                type="checkbox"
                checked={fullDay}
                onChange={(event) => setFullDay(event.target.checked)}
                className="size-4 accent-primary"
              />
              Bloquear o dia inteiro
            </label>

            {!fullDay && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
                  Início
                  <Input name="startTime" type="time" step={1800} required />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
                  Fim
                  <Input name="endTime" type="time" step={1800} required />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1.5 text-sm font-medium text-card-foreground">
              Motivo
              <Input
                name="reason"
                type="text"
                minLength={3}
                maxLength={160}
                placeholder="Ex.: feriado municipal"
                required
              />
            </label>

            <Button type="submit" size="lg" disabled={isSubmitting || barbers.length === 0}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <CalendarOff />}
              {isSubmitting ? 'Bloqueando...' : 'Bloquear período'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Próximos bloqueios</h2>
          <p className="text-sm text-muted-foreground">
            Horários bloqueados deixam de aparecer como disponíveis para os clientes.
          </p>
        </div>

        {blocks.length === 0 ? (
          <Empty className="rounded-2xl border border-border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarOff />
              </EmptyMedia>
              <EmptyTitle>Nenhum bloqueio futuro</EmptyTitle>
              <EmptyDescription>A agenda segue disponível nos horários normais.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-3">
            {blocks.map((block) => (
              <Card key={block.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <div>
                      <span className="font-medium text-card-foreground">{block.reason}</span>
                      <p className="text-sm text-muted-foreground">{formatDateLong(block.date)}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <UserRound className="size-4 text-primary" />
                        {block.barberName}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-4 text-primary" />
                        {block.startTime && block.endTime
                          ? `${block.startTime} às ${block.endTime}`
                          : 'Dia inteiro'}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void removeBlock(block)}
                    disabled={Boolean(deletingId)}
                  >
                    {deletingId === block.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                    Remover
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
