'use client'

import { useRouter } from 'next/navigation'
import { History } from 'lucide-react'
import { AppointmentCard } from '@/components/appointment-card'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import type { Appointment } from '@/lib/types'

export function HistoryList({ appointments }: { appointments: Appointment[] }) {
  const router = useRouter()

  function handleBookAgain(appointment: Appointment) {
    router.push(`/app/agendar?servico=${appointment.serviceId}&barbeiro=${appointment.barberId}`)
  }

  if (appointments.length === 0) {
    return (
      <Empty className="rounded-2xl border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>Nenhum atendimento por aqui ainda</EmptyTitle>
          <EmptyDescription>Seu histórico aparecerá após o primeiro atendimento.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {appointments.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          onBookAgain={
            appointment.status === 'concluido' ? () => handleBookAgain(appointment) : undefined
          }
        />
      ))}
    </div>
  )
}
