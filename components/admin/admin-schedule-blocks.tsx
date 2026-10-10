'use client'

import { type FormEvent, useState } from 'react'
import { CalendarOff, Clock, LoaderCircle, Trash2, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { TimeSelect } from '@/components/ui/time-select'
import {
  getApiMessage,
  type AdminScheduleBlockFormErrors,
  type AdminScheduleBlockFormField,
  validateAdminScheduleBlockForm,
} from '@/lib/admin-settings-form-validation'
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
  canSelectBarber,
  currentBarberId,
}: {
  initial: ScheduleBlock[]
  barbers: Barber[]
  today: string
  canSelectBarber: boolean
  currentBarberId: string | null
}) {
  const [blocks, setBlocks] = useState(initial)
  const [fullDay, setFullDay] = useState(true)
  const [date, setDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [errors, setErrors] = useState<AdminScheduleBlockFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function clearError(field: AdminScheduleBlockFormField) {
    setErrors((current) => {
      if (!current[field]) return current

      const next = { ...current }
      delete next[field]
      return next
    })
    setSubmitError(null)
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const validation = validateAdminScheduleBlockForm({
      barberId: String(data.get('barberId') ?? ''),
      date,
      fullDay,
      startTime,
      endTime,
      reason: String(data.get('reason') ?? ''),
      today,
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
      const response = await fetch('/api/admin/schedule-blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(validation.data),
      })
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok || !result?.block) {
        setSubmitError(
          getApiMessage(result, 'Não foi possível criar o bloqueio. Tente novamente.'),
        )
        return
      }

      setBlocks((current) => sortBlocks([...current, result.block!]))
      form.reset()
      setFullDay(true)
      setDate(today)
      setStartTime('')
      setEndTime('')
      setErrors({})
      setSubmitError(null)
      toast.success('Período bloqueado com sucesso.')
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Tente novamente em instantes.')
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
        toast.error(getApiMessage(result, 'Não foi possível remover o bloqueio. Tente novamente.'))
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
          <form
            className="flex flex-col gap-5"
            onSubmit={createBlock}
            noValidate
            aria-busy={isSubmitting}
          >
            <div>
              <h2 className="font-serif text-xl text-card-foreground">Novo bloqueio</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use para folgas, feriados, almoço ou compromissos.
              </p>
            </div>

            <FieldGroup>
              {canSelectBarber ? (
                <Field data-invalid={Boolean(errors.barberId)}>
                  <FieldLabel htmlFor="block-barber">Barbeiro</FieldLabel>
                <select
                  id="block-barber"
                  name="barberId"
                  required
                  defaultValue="all"
                    aria-invalid={Boolean(errors.barberId)}
                    aria-describedby={errors.barberId ? 'block-barber-error' : undefined}
                    onChange={() => clearError('barberId')}
                    className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
                >
                  <option value="all">Todos os barbeiros</option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
                  <FieldError id="block-barber-error">{errors.barberId}</FieldError>
                </Field>
              ) : (
                <input name="barberId" type="hidden" value={currentBarberId ?? ''} />
              )}

              <Field data-invalid={Boolean(errors.date)}>
                <FieldLabel htmlFor="block-date">Data</FieldLabel>
                <DatePicker
                  id="block-date"
                  name="date"
                  value={date}
                  min={today}
                  ariaInvalid={Boolean(errors.date)}
                  ariaDescribedBy={errors.date ? 'block-date-error' : undefined}
                  onValueChange={(value) => {
                    setDate(value)
                    clearError('date')
                  }}
                  dialogTitle="Escolha o dia do bloqueio"
                  className="w-full"
                />
                <FieldError id="block-date-error">{errors.date}</FieldError>
              </Field>
            </FieldGroup>

            <label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
              <input
                type="checkbox"
                checked={fullDay}
                onChange={(event) => {
                  setFullDay(event.target.checked)
                  if (event.target.checked) {
                    setStartTime('')
                    setEndTime('')
                    setErrors((current) => {
                      const next = { ...current }
                      delete next.startTime
                      delete next.endTime
                      return next
                    })
                  }
                  setSubmitError(null)
                }}
                className="size-4 accent-primary"
              />
              Bloquear o dia inteiro
            </label>

            {!fullDay && (
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={Boolean(errors.startTime)}>
                  <FieldLabel htmlFor="block-start-time">Início</FieldLabel>
                  <TimeSelect
                    id="block-start-time"
                    name="startTime"
                    value={startTime}
                    required
                    ariaInvalid={Boolean(errors.startTime)}
                    ariaDescribedBy={errors.startTime ? 'block-start-time-error' : undefined}
                    placeholder="Selecione o início"
                    onValueChange={(value) => {
                      setStartTime(value)
                      if (endTime && value >= endTime) setEndTime('')
                      clearError('startTime')
                      if (errors.endTime) clearError('endTime')
                    }}
                  />
                  <FieldError id="block-start-time-error">{errors.startTime}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.endTime)}>
                  <FieldLabel htmlFor="block-end-time">Fim</FieldLabel>
                  <TimeSelect
                    id="block-end-time"
                    name="endTime"
                    value={endTime}
                    min={startTime || undefined}
                    excludeMin
                    required
                    disabled={!startTime}
                    ariaInvalid={Boolean(errors.endTime)}
                    ariaDescribedBy={errors.endTime ? 'block-end-time-error' : undefined}
                    placeholder={startTime ? 'Selecione o término' : 'Escolha o início primeiro'}
                    onValueChange={(value) => {
                      setEndTime(value)
                      clearError('endTime')
                    }}
                  />
                  <FieldError id="block-end-time-error">{errors.endTime}</FieldError>
                </Field>
              </div>
            )}

            <Field data-invalid={Boolean(errors.reason)}>
              <FieldLabel htmlFor="block-reason">Motivo</FieldLabel>
              <Input
                id="block-reason"
                name="reason"
                type="text"
                minLength={3}
                maxLength={160}
                placeholder="Ex.: feriado municipal"
                aria-invalid={Boolean(errors.reason)}
                aria-describedby={errors.reason ? 'block-reason-error' : undefined}
                onValueChange={() => clearError('reason')}
                required
              />
              <FieldError id="block-reason-error">{errors.reason}</FieldError>
            </Field>

            {submitError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {submitError}
              </p>
            )}

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

                  {block.canDelete && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void removeBlock(block)}
                      disabled={Boolean(deletingId)}
                    >
                      {deletingId === block.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                      Remover
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
