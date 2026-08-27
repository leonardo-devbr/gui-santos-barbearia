'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import { AppointmentCard } from '@/components/appointment-card'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getServiceById } from '@/data/services'
import type { Appointment } from '@/lib/types'

export function AppointmentsList({ initial }: { initial: Appointment[] }) {
  const router = useRouter()
  const [appointments, setAppointments] = useState(initial)
  const [toCancel, setToCancel] = useState<Appointment | null>(null)

  function handleReschedule(appointment: Appointment) {
    router.push(`/app/agendar?servico=${appointment.serviceId}&barbeiro=${appointment.barberId}`)
  }

  function confirmCancel() {
    if (!toCancel) return
    const service = getServiceById(toCancel.serviceId)
    setAppointments((prev) => prev.filter((a) => a.id !== toCancel.id))
    toast.success('Agendamento cancelado', {
      description: `${service?.name ?? 'Serviço'} foi cancelado.`,
    })
    setToCancel(null)
  }

  if (appointments.length === 0) {
    return (
      <Empty className="rounded-2xl border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarPlus />
          </EmptyMedia>
          <EmptyTitle>Nenhum agendamento futuro</EmptyTitle>
          <EmptyDescription>Reserve seu próximo horário quando quiser.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/app/agendar" />} nativeButton={false}>
            Agendar horário
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {appointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            onReschedule={() => handleReschedule(appointment)}
            onCancel={() => setToCancel(appointment)}
          />
        ))}
      </div>

      <AlertDialog open={Boolean(toCancel)} onOpenChange={(open) => !open && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Você poderá agendar um novo horário depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Cancelar agendamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
