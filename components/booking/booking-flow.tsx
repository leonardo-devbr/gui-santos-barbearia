'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, CalendarDays, Clock, LoaderCircle, Scissors, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ServiceCard } from '@/components/service-card'
import { BarberCard } from '@/components/barber-card'
import { cn } from '@/lib/utils'
import { formatDateLong, formatPrice } from '@/lib/format'
import type { Barber, Service, TimeSlot } from '@/lib/types'

const steps = ['Serviço', 'Barbeiro', 'Data', 'Horário', 'Confirmar'] as const

// Gera os próximos dias úteis (terça a sábado) a partir de hoje.
function getNextDays(count: number) {
  const days: { iso: string; weekday: string; day: string; month: string }[] = []
  const date = new Date()
  const weekdays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  while (days.length < count) {
    date.setDate(date.getDate() + 1)
    const dow = date.getDay()
    if (dow === 0 || dow === 1) continue // fechado domingo e segunda
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`
    days.push({
      iso,
      weekday: weekdays[dow],
      day: String(date.getDate()).padStart(2, '0'),
      month: months[date.getMonth()],
    })
  }
  return days
}

interface BookingFlowProps {
  services: Service[]
  barbers: Barber[]
  appointmentId?: string
  initialServiceId?: string
  initialBarberId?: string
}

interface BookingResponse {
  message?: string
}

interface AvailabilityResponse {
  message?: string
  slots?: unknown
}

function isTimeSlot(value: unknown): value is TimeSlot {
  if (!value || typeof value !== 'object') return false

  const slot = value as Partial<TimeSlot>
  return (
    typeof slot.time === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(slot.time) &&
    typeof slot.available === 'boolean'
  )
}

export function BookingFlow({
  services,
  barbers,
  appointmentId,
  initialServiceId,
  initialBarberId,
}: BookingFlowProps) {
  const router = useRouter()
  const days = useMemo(() => getNextDays(12), [])
  const isRescheduling = Boolean(appointmentId)
  const validInitialServiceId = initialServiceId && services.some((service) => service.id === initialServiceId)
    ? initialServiceId
    : undefined
  const validInitialBarberId = initialBarberId && barbers.some((barber) => barber.id === initialBarberId)
    ? initialBarberId
    : undefined

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState<string | undefined>(validInitialServiceId)
  const [barberId, setBarberId] = useState<string | undefined>(validInitialBarberId)
  const [date, setDate] = useState<string | undefined>()
  const [time, setTime] = useState<string | undefined>()
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const availabilityRequestId = useRef(0)

  const service = serviceId ? services.find((item) => item.id === serviceId) : undefined
  const barber = barberId ? barbers.find((item) => item.id === barberId) : undefined

  const canAdvance =
    (step === 0 && Boolean(serviceId)) ||
    (step === 1 && Boolean(barberId)) ||
    (step === 2 && Boolean(date)) ||
    (step === 3 && Boolean(time)) ||
    step === 4

  function next() {
    if (canAdvance && step < steps.length - 1) setStep((s) => s + 1)
  }

  function back() {
    if (step > 0) setStep((s) => s - 1)
    else router.back()
  }

  function selectService(nextServiceId: string) {
    if (nextServiceId === serviceId) return
    setServiceId(nextServiceId)
    setBarberId(undefined)
    setDate(undefined)
    setTime(undefined)
    setTimeSlots([])
    setAvailabilityError(null)
    setIsLoadingSlots(false)
    availabilityRequestId.current += 1
    setSubmitError(null)
  }

  function selectBarber(nextBarberId: string) {
    if (nextBarberId === barberId) return
    setBarberId(nextBarberId)
    setDate(undefined)
    setTime(undefined)
    setTimeSlots([])
    setAvailabilityError(null)
    setIsLoadingSlots(false)
    availabilityRequestId.current += 1
    setSubmitError(null)
  }

  async function loadAvailability(selectedDate: string) {
    if (!serviceId || !barberId) return

    const requestId = availabilityRequestId.current + 1
    availabilityRequestId.current = requestId
    setTimeSlots([])
    setAvailabilityError(null)
    setIsLoadingSlots(true)

    const params = new URLSearchParams({ serviceId, barberId, date: selectedDate })

    try {
      const response = await fetch(`/api/availability?${params.toString()}`, {
        credentials: 'include',
      })
      const result = (await response.json().catch(() => null)) as AvailabilityResponse | null

      if (requestId !== availabilityRequestId.current) return

      if (!response.ok) {
        setAvailabilityError(result?.message ?? 'Não foi possível consultar os horários disponíveis.')
        return
      }

      if (!Array.isArray(result?.slots) || !result.slots.every(isTimeSlot)) {
        setAvailabilityError('O servidor retornou uma lista de horários inválida.')
        return
      }

      setTimeSlots(result.slots)
    } catch {
      if (requestId === availabilityRequestId.current) {
        setAvailabilityError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
      }
    } finally {
      if (requestId === availabilityRequestId.current) setIsLoadingSlots(false)
    }
  }

  function selectDate(nextDate: string) {
    if (nextDate === date && (isLoadingSlots || timeSlots.length > 0)) return
    setDate(nextDate)
    setTime(undefined)
    setSubmitError(null)
    void loadAvailability(nextDate)
  }

  async function confirm() {
    if (!serviceId || !barberId || !date || !time || !service || !barber) {
      setSubmitError('O agendamento está incompleto. Revise as etapas anteriores.')
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      const endpoint = appointmentId
        ? `/api/appointments/${encodeURIComponent(appointmentId)}`
        : '/api/appointments'
      const response = await fetch(endpoint, {
        method: appointmentId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ serviceId, barberId, date, time }),
      })
      const result = (await response.json().catch(() => null)) as BookingResponse | null

      if (!response.ok) {
        setSubmitError(result?.message ?? 'Não foi possível confirmar o agendamento. Tente outro horário.')
        return
      }

      toast.success(isRescheduling ? 'Agendamento remarcado!' : 'Agendamento confirmado!', {
        description: `${service.name} com ${barber.name.split(' ')[0]} em ${formatDateLong(date)} às ${time}.`,
      })
      router.push('/app/agendamentos')
      router.refresh()
    } catch {
      setSubmitError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-8" aria-busy={isSubmitting}>
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                aria-current={i === step ? 'step' : undefined}
                aria-label={`${i + 1}. ${label}`}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                  i < step && 'border-primary bg-primary text-primary-foreground',
                  i === step && 'border-primary bg-primary/15 text-primary',
                  i > step && 'border-border text-muted-foreground',
                )}
              >
                {i < step ? <Check className="size-4" aria-hidden="true" /> : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-[11px] sm:block',
                  i <= step ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('h-px flex-1', i < step ? 'bg-primary' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex flex-col gap-4">
        {step === 0 && (
          <>
            <h2 className="font-serif text-2xl text-foreground">Escolha o serviço</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {services.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  selected={serviceId === s.id}
                  onSelect={() => selectService(s.id)}
                />
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-serif text-2xl text-foreground">Escolha o barbeiro</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {barbers.map((b) => (
                <BarberCard
                  key={b.id}
                  barber={b}
                  compact
                  selected={barberId === b.id}
                  onSelect={() => selectBarber(b.id)}
                />
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-serif text-2xl text-foreground">Escolha a data</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {days.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  aria-pressed={date === d.iso}
                  onClick={() => selectDate(d.iso)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors',
                    date === d.iso
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <span className="text-xs uppercase tracking-wide">{d.weekday}</span>
                  <span className="font-serif text-xl text-foreground">{d.day}</span>
                  <span className="text-xs uppercase">{d.month}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-serif text-2xl text-foreground">Escolha o horário</h2>
            {isLoadingSlots ? (
              <div className="flex min-h-32 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground" role="status">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Consultando horários disponíveis...
              </div>
            ) : availabilityError ? (
              <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-center">
                <p role="alert" className="text-sm text-destructive">{availabilityError}</p>
                <Button type="button" variant="outline" onClick={() => date && void loadAvailability(date)}>
                  Tentar novamente
                </Button>
              </div>
            ) : timeSlots.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
                Não há horários disponíveis para esta data. Volte e escolha outro dia.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {timeSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    aria-pressed={time === slot.time}
                    onClick={() => {
                      setTime(slot.time)
                      setSubmitError(null)
                    }}
                    className={cn(
                      'rounded-lg border py-3 text-sm font-medium transition-colors',
                      !slot.available && 'cursor-not-allowed border-border/50 text-muted-foreground/40 line-through',
                      slot.available &&
                        time === slot.time &&
                        'border-primary bg-primary/10 text-foreground',
                      slot.available &&
                        time !== slot.time &&
                        'border-border bg-card text-foreground hover:border-primary/50',
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-serif text-2xl text-foreground">
              {isRescheduling ? 'Confirme a remarcação' : 'Confirme o agendamento'}
            </h2>
            <Card>
              <CardContent className="flex flex-col gap-4">
                <SummaryRow icon={Scissors} label="Serviço" value={service?.name ?? '-'} />
                <SummaryRow icon={User} label="Barbeiro" value={barber?.name ?? '-'} />
                <SummaryRow
                  icon={CalendarDays}
                  label="Data"
                  value={date ? formatDateLong(date) : '-'}
                />
                <SummaryRow icon={Clock} label="Horário" value={time ?? '-'} />
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm text-muted-foreground">
                    Duração {service?.durationMinutes} min
                  </span>
                  <span className="font-serif text-xl text-primary">
                    {service ? formatPrice(service.price) : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Navigation */}
      {submitError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={back} disabled={isSubmitting}>
          <ChevronLeft className="size-4" />
          {step === 0 ? 'Voltar' : 'Anterior'}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={next} disabled={!canAdvance}>
            Continuar
          </Button>
        ) : (
          <Button onClick={confirm} disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
            {isSubmitting
              ? isRescheduling
                ? 'Remarcando...'
                : 'Confirmando...'
              : isRescheduling
                ? 'Confirmar remarcação'
                : 'Confirmar agendamento'}
          </Button>
        )}
      </div>
    </div>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scissors
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
