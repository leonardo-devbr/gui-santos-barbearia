'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilterX,
} from 'lucide-react'
import { AdminAppointmentsList } from '@/components/admin/admin-appointments-list'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { TimeSelect } from '@/components/ui/time-select'
import {
  filterAdminAppointments,
  shiftAgendaReference,
  type AgendaFilters,
  type AgendaView,
} from '@/lib/admin-agenda'
import { addDaysToIsoDate } from '@/lib/date'
import { formatDateNumeric, formatDateWeekday, formatMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdminAppointment, AppointmentStatus, Barber } from '@/lib/types'

const viewLabels: Record<AgendaView, string> = {
  day: 'Diária',
  week: 'Semanal',
  month: 'Mensal',
}

const monthLabels = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const emptyFilters: AgendaFilters = {
  serviceId: '',
  customerId: '',
  startTime: '',
  endTime: '',
}

function datesBetween(startDate: string, endDate: string) {
  const dates: string[] = []
  let current = startDate

  while (current <= endDate) {
    dates.push(current)
    current = addDaysToIsoDate(current, 1)
  }

  return dates
}

function getPeriodLabel(view: AgendaView, startDate: string, endDate: string) {
  if (view === 'day') {
    return `${formatDateWeekday(startDate)} · ${formatDateNumeric(startDate)}`
  }
  if (view === 'week') {
    return `${formatDateNumeric(startDate)} a ${formatDateNumeric(endDate)}`
  }
  return formatMonthYear(startDate)
}

function selectClassName() {
  return 'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50'
}

export function AdminAgenda({
  initialAppointments,
  view,
  referenceDate,
  startDate,
  endDate,
  barbers,
  selectedBarberId,
  isAdmin,
}: {
  initialAppointments: AdminAppointment[]
  view: AgendaView
  referenceDate: string
  startDate: string
  endDate: string
  barbers: Barber[]
  selectedBarberId: string
  isAdmin: boolean
}) {
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const [appointments, setAppointments] = useState(initialAppointments)
  const [filters, setFilters] = useState<AgendaFilters>(emptyFilters)

  const services = useMemo(() => {
    const options = new Map<string, string>()
    for (const appointment of appointments) {
      options.set(appointment.serviceId, appointment.serviceName ?? 'Serviço')
    }
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
  }, [appointments])

  const customers = useMemo(() => {
    const options = new Map<string, string>()
    for (const appointment of appointments) {
      options.set(appointment.customerId, appointment.customerName)
    }
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
  }, [appointments])

  const filteredAppointments = useMemo(
    () => filterAdminAppointments(appointments, filters),
    [appointments, filters],
  )
  const appointmentsByDate = useMemo(() => {
    const groups = new Map<string, AdminAppointment[]>()
    for (const appointment of filteredAppointments) {
      const current = groups.get(appointment.date) ?? []
      current.push(appointment)
      groups.set(appointment.date, current)
    }
    return groups
  }, [filteredAppointments])

  const hasFilters = Object.values(filters).some(Boolean)
  const referenceYear = Number(referenceDate.slice(0, 4))
  const referenceMonth = Number(referenceDate.slice(5, 7))
  const availableYears = Array.from(
    { length: 16 },
    (_, index) => referenceYear - 10 + index,
  )

  function navigate(nextView: AgendaView, nextDate: string, nextBarberId = selectedBarberId) {
    const params = new URLSearchParams({ view: nextView, date: nextDate })
    if (isAdmin && nextBarberId) params.set('barber', nextBarberId)
    startNavigation(() => router.push(`/admin/agendamentos?${params.toString()}`))
  }

  function updateMonth(month: number, year = referenceYear) {
    navigate('month', `${year}-${String(month).padStart(2, '0')}-01`)
  }

  function openDay(date: string) {
    navigate('day', date)
  }

  function updateStatus(
    appointmentId: string,
    status: Extract<AppointmentStatus, 'concluido' | 'cancelado'>,
  ) {
    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === appointmentId
          ? { ...appointment, status, canComplete: false, canCancel: false }
          : appointment,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-6" aria-busy={isNavigating}>
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium tracking-[0.16em] text-muted-foreground">
                VISUALIZAÇÃO
              </span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(viewLabels) as AgendaView[]).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={view === option ? 'default' : 'outline'}
                    onClick={() => navigate(option, referenceDate)}
                    disabled={isNavigating}
                  >
                    {viewLabels[option]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Período anterior"
                disabled={isNavigating}
                onClick={() => navigate(view, shiftAgendaReference(referenceDate, view, -1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>

              {view === 'month' ? (
                <div className="flex gap-2">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                    Mês
                    <select
                      value={referenceMonth}
                      className={cn(selectClassName(), 'min-w-36')}
                      onChange={(event) => updateMonth(Number(event.target.value))}
                    >
                      {monthLabels.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                    Ano
                    <select
                      value={referenceYear}
                      className={cn(selectClassName(), 'w-28')}
                      onChange={(event) => updateMonth(referenceMonth, Number(event.target.value))}
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                  {view === 'day' ? 'Dia' : 'Semana que contém o dia'}
                  <DatePicker
                    value={referenceDate}
                    onValueChange={(date) => navigate(view, date)}
                    dialogTitle={view === 'day' ? 'Escolha o dia' : 'Escolha uma semana'}
                    className="min-w-44"
                  />
                </label>
              )}

              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Próximo período"
                disabled={isNavigating}
                onClick={() => navigate(view, shiftAgendaReference(referenceDate, view, 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <span className="text-xs font-medium tracking-[0.15em] text-primary">PERÍODO ATUAL</span>
            <p className="mt-1 font-serif text-xl text-foreground">
              {getPeriodLabel(view, startDate, endDate)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {isAdmin && (
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                Barbeiro
                <select
                  value={selectedBarberId}
                  className={selectClassName()}
                  onChange={(event) => navigate(view, referenceDate, event.target.value)}
                >
                  <option value="">Todos os barbeiros</option>
                  {barbers.map((barber) => (
                    <option key={barber.id} value={barber.id}>
                      {barber.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Serviço
              <select
                value={filters.serviceId}
                className={selectClassName()}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, serviceId: event.target.value }))
                }
              >
                <option value="">Todos os serviços</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Cliente
              <select
                value={filters.customerId}
                className={selectClassName()}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, customerId: event.target.value }))
                }
              >
                <option value="">Todos os clientes</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Horário inicial
              <TimeSelect
                value={filters.startTime}
                placeholder="Desde qualquer horário"
                onValueChange={(startTime) =>
                  setFilters((current) => ({
                    ...current,
                    startTime,
                    endTime:
                      current.endTime && startTime && current.endTime < startTime
                        ? ''
                        : current.endTime,
                  }))
                }
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Horário final
              <TimeSelect
                value={filters.endTime}
                min={filters.startTime || undefined}
                placeholder="Até qualquer horário"
                onValueChange={(endTime) => setFilters((current) => ({ ...current, endTime }))}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Exibindo {filteredAppointments.length} de {appointments.length}{' '}
              {appointments.length === 1 ? 'agendamento' : 'agendamentos'} no período.
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={!hasFilters}
              onClick={() => setFilters(emptyFilters)}
            >
              <FilterX aria-hidden="true" />
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === 'day' && (
        <AdminAppointmentsList
          appointments={filteredAppointments}
          onStatusChange={updateStatus}
          emptyTitle="Nenhum agendamento neste dia"
          emptyDescription={
            hasFilters
              ? 'Nenhum agendamento corresponde aos filtros escolhidos.'
              : 'A agenda está livre para o dia selecionado.'
          }
        />
      )}

      {view === 'week' && (
        <WeekAgenda
          dates={datesBetween(startDate, endDate)}
          appointmentsByDate={appointmentsByDate}
          onOpenDay={openDay}
        />
      )}

      {view === 'month' && (
        <MonthAgenda
          startDate={startDate}
          endDate={endDate}
          appointmentsByDate={appointmentsByDate}
          onOpenDay={openDay}
        />
      )}
    </div>
  )
}

function WeekAgenda({
  dates,
  appointmentsByDate,
  onOpenDay,
}: {
  dates: string[]
  appointmentsByDate: Map<string, AdminAppointment[]>
  onOpenDay: (date: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
      {dates.map((date) => {
        const appointments = appointmentsByDate.get(date) ?? []
        return (
          <Card key={date} className="min-w-0">
            <CardContent className="flex h-full flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    {formatDateWeekday(date)}
                  </p>
                  <p className="mt-1 font-serif text-lg text-foreground">
                    {formatDateNumeric(date)}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {appointments.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2">
                {appointments.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Agenda livre</p>
                ) : (
                  appointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-lg border border-border bg-background/60 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-primary">{appointment.time}</span>
                        <StatusBadge status={appointment.status} />
                      </div>
                      <p className="mt-2 truncate text-sm text-foreground">
                        {appointment.customerName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {appointment.serviceName}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <Button type="button" size="sm" variant="outline" onClick={() => onOpenDay(date)}>
                Abrir dia
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function MonthAgenda({
  startDate,
  endDate,
  appointmentsByDate,
  onOpenDay,
}: {
  startDate: string
  endDate: string
  appointmentsByDate: Map<string, AdminAppointment[]>
  onOpenDay: (date: string) => void
}) {
  const firstWeekday = new Date(`${startDate}T12:00:00.000Z`).getUTCDay()
  const lastWeekday = new Date(`${endDate}T12:00:00.000Z`).getUTCDay()
  const gridStart = addDaysToIsoDate(startDate, -((firstWeekday + 6) % 7))
  const gridEnd = addDaysToIsoDate(endDate, (7 - ((lastWeekday + 6) % 7) - 1) % 7)
  const dates = datesBetween(gridStart, gridEnd)

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((weekday) => (
            <div
              key={weekday}
              className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const appointments = appointmentsByDate.get(date) ?? []
            const outside = date < startDate || date > endDate
            return (
              <button
                key={date}
                type="button"
                disabled={outside}
                onClick={() => onOpenDay(date)}
                className={cn(
                  'min-h-36 border-r border-b border-border p-3 text-left transition-colors last:border-r-0 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  outside && 'cursor-default bg-muted/20 opacity-35 hover:bg-muted/20',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-lg text-foreground">{Number(date.slice(8))}</span>
                  {appointments.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {appointments.length}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-col gap-1.5">
                  {appointments.slice(0, 3).map((appointment) => (
                    <span
                      key={appointment.id}
                      className="flex items-center gap-1.5 truncate rounded-md bg-background px-2 py-1 text-xs text-muted-foreground"
                    >
                      <Clock3 className="size-3 shrink-0 text-primary" aria-hidden="true" />
                      <strong className="font-medium text-foreground">{appointment.time}</strong>
                      <span className="truncate">{appointment.customerName}</span>
                    </span>
                  ))}
                  {appointments.length > 3 && (
                    <span className="text-xs text-primary">
                      + {appointments.length - 3} agendamento(s)
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
