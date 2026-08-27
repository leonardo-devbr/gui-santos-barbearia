import { CalendarDays, Clock, Scissors } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { getServiceById } from '@/data/services'
import { getBarberById } from '@/data/barbers'
import { formatDateLong, formatPrice } from '@/lib/format'
import type { Appointment } from '@/lib/types'

interface AppointmentCardProps {
  appointment: Appointment
  onReschedule?: () => void
  onCancel?: () => void
  onBookAgain?: () => void
}

export function AppointmentCard({
  appointment,
  onReschedule,
  onCancel,
  onBookAgain,
}: AppointmentCardProps) {
  const service = getServiceById(appointment.serviceId)
  const barber = getBarberById(appointment.barberId)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-serif text-lg text-card-foreground">{service?.name}</h3>
            <p className="text-sm text-muted-foreground">Com {barber?.name}</p>
          </div>
          <StatusBadge status={appointment.status} />
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4 text-primary" />
            {formatDateLong(appointment.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-primary" />
            {appointment.time}
          </span>
          <span className="flex items-center gap-1.5">
            <Scissors className="size-4 text-primary" />
            {formatPrice(appointment.price)}
          </span>
        </div>

        {(onReschedule || onCancel || onBookAgain) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onBookAgain && (
              <Button size="sm" onClick={onBookAgain}>
                Agendar novamente
              </Button>
            )}
            {onReschedule && (
              <Button size="sm" variant="outline" onClick={onReschedule}>
                Remarcar
              </Button>
            )}
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
