'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, CalendarDays, Clock, Scissors, User } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ServiceCard } from '@/components/service-card'
import { BarberCard } from '@/components/barber-card'
import { cn } from '@/lib/utils'
import { formatDateLong, formatPrice } from '@/lib/format'
import { services, getServiceById } from '@/data/services'
import { barbers, getBarberById } from '@/data/barbers'
import { mockTimeSlots } from '@/data/appointments'

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
  initialServiceId?: string
  initialBarberId?: string
}

export function BookingFlow({ initialServiceId, initialBarberId }: BookingFlowProps) {
  const router = useRouter()
  const days = useMemo(() => getNextDays(12), [])

  const [step, setStep] = useState(0)
  const [serviceId, setServiceId] = useState<string | undefined>(initialServiceId)
  const [barberId, setBarberId] = useState<string | undefined>(initialBarberId)
  const [date, setDate] = useState<string | undefined>()
  const [time, setTime] = useState<string | undefined>()

  const service = serviceId ? getServiceById(serviceId) : undefined
  const barber = barberId ? getBarberById(barberId) : undefined

  const canAdvance =
    (step === 0 && Boolean(serviceId)) ||
    (step === 1 && Boolean(barberId)) ||
    (step === 2 && Boolean(date)) ||
    (step === 3 && Boolean(time)) ||
    step === 4

  function next() {
    if (step < steps.length - 1) setStep((s) => s + 1)
  }
  function back() {
    if (step > 0) setStep((s) => s - 1)
    else router.back()
  }

  function confirm() {
    toast.success('Agendamento confirmado!', {
      description: `${service?.name} com ${barber?.name.split(' ')[0]} em ${
        date ? formatDateLong(date) : ''
      } às ${time}.`,
    })
    router.push('/app/agendamentos')
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors',
                  i < step && 'border-primary bg-primary text-primary-foreground',
                  i === step && 'border-primary bg-primary/15 text-primary',
                  i > step && 'border-border text-muted-foreground',
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
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
                  onSelect={() => setServiceId(s.id)}
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
                  onSelect={() => setBarberId(b.id)}
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
                  onClick={() => setDate(d.iso)}
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
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {mockTimeSlots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  onClick={() => setTime(slot.time)}
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
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-serif text-2xl text-foreground">Confirme o agendamento</h2>
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
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={back}>
          <ChevronLeft className="size-4" />
          {step === 0 ? 'Voltar' : 'Anterior'}
        </Button>
        {step < steps.length - 1 ? (
          <Button onClick={next} disabled={!canAdvance}>
            Continuar
          </Button>
        ) : (
          <Button onClick={confirm}>Confirmar agendamento</Button>
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
