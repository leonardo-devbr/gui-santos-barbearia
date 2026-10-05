'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  LoaderCircle,
  Scissors,
  User,
} from 'lucide-react'
import { ptBR } from 'react-day-picker/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { ServiceCard } from '@/components/service-card'
import { BarberCard } from '@/components/barber-card'
import {
  getBookingAvailabilityPeriod,
  isBookingDayAvailability,
  MAX_BOOKING_DAYS_AHEAD,
  type BookingDayStatus,
} from '@/lib/booking-calendar'
import { addDaysToIsoDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { formatDateLong, formatPrice } from '@/lib/format'
import type { Barber, Service, TimeSlot } from '@/lib/types'

const steps = ['Serviço', 'Barbeiro', 'Data e horário', 'Confirmar'] as const

interface BookingFlowProps {
  services: Service[]
  barbers: Barber[]
  today: string
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
  days?: unknown
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

function isoToLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDateToIso(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}

function getYearMonth(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

export function BookingFlow({
  services,
  barbers,
  today,
  appointmentId,
  initialServiceId,
  initialBarberId,
}: BookingFlowProps) {
  const router = useRouter()
  const isRescheduling = Boolean(appointmentId)
  const validInitialServiceId = initialServiceId && services.some((service) => service.id === initialServiceId)
    ? initialServiceId
    : undefined
  const validInitialBarberId = initialBarberId && barbers.some((barber) => barber.id === initialBarberId)
    ? initialBarberId
    : undefined
  const firstCalendarDate = useMemo(() => isoToLocalDate(today), [today])
  const lastBookingDate = useMemo(
    () => addDaysToIsoDate(today, MAX_BOOKING_DAYS_AHEAD),
    [today],
  )
  const lastCalendarDate = useMemo(() => isoToLocalDate(lastBookingDate), [lastBookingDate])

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState<string | undefined>(validInitialServiceId)
  const [barberId, setBarberId] = useState<string | undefined>(validInitialBarberId)
  const [date, setDate] = useState<string | undefined>()
  const [time, setTime] = useState<string | undefined>()
  const [calendarMonth, setCalendarMonth] = useState(firstCalendarDate)
  const [calendarDays, setCalendarDays] = useState<Record<string, BookingDayStatus>>({})
  const [calendarError, setCalendarError] = useState<string | null>(null)
  const [calendarReloadKey, setCalendarReloadKey] = useState(0)
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const availabilityRequestId = useRef(0)
  const calendarRequestId = useRef(0)

  const service = serviceId ? services.find((item) => item.id === serviceId) : undefined
  const barber = barberId ? barbers.find((item) => item.id === barberId) : undefined
  const selectedCalendarDate = useMemo(() => (date ? isoToLocalDate(date) : undefined), [date])
  const closedDates = useMemo(
    () =>
      Object.entries(calendarDays)
        .filter(([, status]) => status === 'closed')
        .map(([iso]) => isoToLocalDate(iso)),
    [calendarDays],
  )
  const availableDates = useMemo(
    () =>
      Object.entries(calendarDays)
        .filter(([, status]) => status === 'available')
        .map(([iso]) => isoToLocalDate(iso)),
    [calendarDays],
  )
  const fullDates = useMemo(
    () =>
      Object.entries(calendarDays)
        .filter(([, status]) => status === 'full')
        .map(([iso]) => isoToLocalDate(iso)),
    [calendarDays],
  )

  const canAdvance =
    (step === 0 && Boolean(serviceId)) ||
    (step === 1 && Boolean(barberId)) ||
    (step === 2 && Boolean(date && time) && !isLoadingSlots) ||
    step === 3

  useEffect(() => {
    if (step !== 2 || !serviceId || !barberId) return

    const period = getBookingAvailabilityPeriod(getYearMonth(calendarMonth), today)
    if (!period) return

    const requestId = calendarRequestId.current + 1
    calendarRequestId.current = requestId
    const controller = new AbortController()
    const params = new URLSearchParams({ serviceId, barberId, ...period })
    if (appointmentId) params.set('appointmentId', appointmentId)

    void (async () => {
      setCalendarDays({})
      setCalendarError(null)
      setIsLoadingCalendar(true)

      try {
        const response = await fetch(`/api/availability?${params.toString()}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const result = (await response.json().catch(() => null)) as AvailabilityResponse | null

        if (requestId !== calendarRequestId.current) return
        if (!response.ok) {
          setCalendarError(result?.message ?? 'Não foi possível consultar os dias disponíveis.')
          return
        }
        if (!Array.isArray(result?.days) || !result.days.every(isBookingDayAvailability)) {
          setCalendarError('O servidor retornou uma lista de dias inválida.')
          return
        }

        const nextDays = Object.fromEntries(
          result.days.map((day) => [day.date, day.status] as const),
        )
        setCalendarDays(nextDays)
      } catch (error) {
        if (
          requestId === calendarRequestId.current &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setCalendarError(
            'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
          )
        }
      } finally {
        if (requestId === calendarRequestId.current) setIsLoadingCalendar(false)
      }
    })()

    return () => controller.abort()
  }, [
    appointmentId,
    barberId,
    calendarMonth,
    calendarReloadKey,
    serviceId,
    step,
    today,
  ])

  function next() {
    if (canAdvance && step < steps.length - 1) setStep((s) => s + 1)
  }

  function back() {
    if (step > 0) setStep((s) => s - 1)
    else router.back()
  }

  function resetAvailability() {
    setDate(undefined)
    setTime(undefined)
    setCalendarMonth(firstCalendarDate)
    setCalendarDays({})
    setCalendarError(null)
    setTimeSlots([])
    setAvailabilityError(null)
    setIsLoadingCalendar(false)
    setIsLoadingSlots(false)
    calendarRequestId.current += 1
    availabilityRequestId.current += 1
    setSubmitError(null)
  }

  function selectService(nextServiceId: string) {
    if (nextServiceId === serviceId) return
    setServiceId(nextServiceId)
    setBarberId(undefined)
    resetAvailability()
  }

  function selectBarber(nextBarberId: string) {
    if (nextBarberId === barberId) return
    setBarberId(nextBarberId)
    resetAvailability()
  }

  function changeCalendarMonth(nextMonth: Date) {
    setCalendarMonth(nextMonth)
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
    if (appointmentId) params.set('appointmentId', appointmentId)

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

      if (!result.slots.some((slot) => slot.available)) {
        setCalendarDays((current) => ({ ...current, [selectedDate]: 'full' }))
        setDate(undefined)
        setAvailabilityError('Este dia não possui mais horários disponíveis. Escolha outra data.')
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
    if (calendarDays[nextDate] !== 'available') return
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
            <div>
              <h2 className="font-serif text-2xl text-foreground">Escolha a data e o horário</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Os horários disponíveis aparecem ao lado assim que você escolhe um dia.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(20rem,27rem)_minmax(0,1fr)]">
              <section
                aria-labelledby="booking-calendar-title"
                aria-busy={isLoadingCalendar}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 id="booking-calendar-title" className="text-sm font-semibold text-foreground">
                    Dias disponíveis
                  </h3>
                  {isLoadingCalendar && (
                    <span
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      role="status"
                    >
                      <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                      Consultando
                    </span>
                  )}
                </div>

                <Calendar
                  mode="single"
                  locale={ptBR}
                  month={calendarMonth}
                  onMonthChange={changeCalendarMonth}
                  selected={selectedCalendarDate}
                  onSelect={(selectedDate) => {
                    if (selectedDate) selectDate(localDateToIso(selectedDate))
                  }}
                  startMonth={new Date(
                    firstCalendarDate.getFullYear(),
                    firstCalendarDate.getMonth(),
                    1,
                  )}
                  endMonth={new Date(
                    lastCalendarDate.getFullYear(),
                    lastCalendarDate.getMonth(),
                    1,
                  )}
                  today={firstCalendarDate}
                  showOutsideDays={false}
                  navLayout="around"
                  disabled={(candidate) => {
                    const iso = localDateToIso(candidate)
                    return (
                      iso < today ||
                      iso > lastBookingDate ||
                      isLoadingCalendar ||
                      Boolean(calendarError) ||
                      calendarDays[iso] !== 'available'
                    )
                  }}
                  modifiers={{ available: availableDates, closed: closedDates, full: fullDates }}
                  modifiersClassNames={{
                    available: '[&_button]:ring-1 [&_button]:ring-primary/25',
                    closed:
                      '[&_button]:bg-muted/60 [&_button]:text-muted-foreground [&_button]:line-through',
                    full:
                      '[&_button]:bg-destructive/10 [&_button]:text-destructive [&_button]:line-through',
                  }}
                  labels={{
                    labelDayButton: (candidate, modifiers) => {
                      const label = candidate.toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                      if (modifiers.closed) return `${label}, barbearia fechada`
                      if (modifiers.full) return `${label}, sem horários disponíveis`
                      if (modifiers.selected) return `${label}, selecionado`
                      if (modifiers.available) return `${label}, disponível`
                      return `${label}, indisponível`
                    },
                  }}
                  footer={
                    date
                      ? `${formatDateLong(date)} selecionado. Escolha um horário disponível.`
                      : 'Escolha um dia disponível para consultar os horários.'
                  }
                  className="mx-auto w-full bg-transparent p-0 [--cell-size:2.5rem] sm:[--cell-size:3rem]"
                  classNames={{ root: 'w-full', month: 'w-full', month_grid: 'w-full' }}
                />

                <div
                  className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground"
                  aria-label="Legenda do calendário"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                    Disponível
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full bg-muted-foreground/50"
                      aria-hidden="true"
                    />
                    Fechado
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-destructive/70" aria-hidden="true" />
                    Sem vagas
                  </span>
                </div>

                {calendarError && (
                  <div className="mt-4 flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                    <p role="alert" className="text-sm text-destructive">
                      {calendarError}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCalendarReloadKey((current) => current + 1)}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}
              </section>

              <section
                aria-labelledby="booking-times-title"
                aria-busy={isLoadingSlots}
                className="min-h-80 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
              >
                <div className="mb-4">
                  <h3 id="booking-times-title" className="font-serif text-xl text-foreground">
                    {date ? `Horários para ${formatDateLong(date)}` : 'Horários disponíveis'}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Todos os horários estão no fuso de Brasília.
                  </p>
                </div>

                {isLoadingSlots ? (
                  <div
                    className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"
                    role="status"
                  >
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    Consultando horários disponíveis...
                  </div>
                ) : availabilityError ? (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                    <p role="alert" className="text-sm text-destructive">
                      {availabilityError}
                    </p>
                    {date && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void loadAvailability(date)}
                      >
                        Tentar novamente
                      </Button>
                    )}
                  </div>
                ) : !date ? (
                  <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                    <CalendarDays className="size-8 text-primary/70" aria-hidden="true" />
                    Selecione um dia disponível no calendário.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-4 2xl:grid-cols-5">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        aria-pressed={time === slot.time}
                        aria-label={`${slot.time}${slot.available ? '' : ', indisponível'}`}
                        onClick={() => {
                          setTime(slot.time)
                          setSubmitError(null)
                        }}
                        className={cn(
                          'rounded-lg border py-3 text-sm font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          !slot.available &&
                            'cursor-not-allowed border-border/50 text-muted-foreground/40 line-through',
                          slot.available &&
                            time === slot.time &&
                            'border-primary bg-primary text-primary-foreground',
                          slot.available &&
                            time !== slot.time &&
                            'border-border bg-background text-foreground hover:border-primary/60 hover:bg-primary/5',
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {step === 3 && (
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
