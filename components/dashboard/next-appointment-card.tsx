import Link from 'next/link'
import { CalendarDays, Clock, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getServiceById } from '@/data/services'
import { getBarberById } from '@/data/barbers'
import { formatDateLong } from '@/lib/format'
import type { Appointment } from '@/lib/types'

interface NextAppointmentCardProps {
  appointment: Appointment
}

export function NextAppointmentCard({ appointment }: NextAppointmentCardProps) {
  const service = getServiceById(appointment.serviceId)
  const barber = getBarberById(appointment.barberId)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-card/60 p-6 sm:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium tracking-[0.25em] text-primary">PRÓXIMO HORÁRIO</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Confirmado
          </span>
        </div>

        <h2 className="font-serif text-3xl text-balance text-foreground sm:text-4xl">
          {service?.name.toUpperCase()}
        </h2>

        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" />
            {formatDateLong(appointment.date)}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            {appointment.time}
          </span>
          <span className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            Barbeiro: {barber?.name.split(' ')[0]}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <Button render={<Link href="/app/agendamentos" />} nativeButton={false}>
            Ver agendamento
          </Button>
          <Button variant="outline" render={<Link href="/app/agendar" />} nativeButton={false}>
            Remarcar
          </Button>
        </div>
      </div>
    </div>
  )
}
