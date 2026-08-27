import Link from 'next/link'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getServiceById } from '@/data/services'
import { formatDateShort } from '@/lib/format'
import type { Appointment } from '@/lib/types'

interface BookAgainCardProps {
  lastAppointment: Appointment
}

export function BookAgainCard({ lastAppointment }: BookAgainCardProps) {
  const service = getServiceById(lastAppointment.serviceId)

  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <RotateCcw className="size-5 text-primary" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            ÚLTIMO SERVIÇO REALIZADO
          </span>
          <span className="font-serif text-lg text-card-foreground">{service?.name}</span>
          <span className="text-sm text-muted-foreground">
            Realizado em {formatDateShort(lastAppointment.date)}
          </span>
        </div>
      </div>
      <Button render={<Link href="/app/agendar" />} nativeButton={false} className="w-full sm:w-auto">
        Agendar novamente
      </Button>
    </div>
  )
}
