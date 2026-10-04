'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarPlus, LoaderCircle } from 'lucide-react'
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
import type { Appointment } from '@/lib/types'

interface AppointmentResponse {
  message?: string
}

export function AppointmentsList({ initial }: { initial: Appointment[] }) {
  const router = useRouter()
  const [appointments, setAppointments] = useState(initial)
  const [toCancel, setToCancel] = useState<Appointment | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)

  function handleReschedule(appointment: Appointment) {
    const params = new URLSearchParams({
      agendamento: appointment.id,
      servico: appointment.serviceId,
      barbeiro: appointment.barberId,
    })
    router.push(`/app/agendar?${params.toString()}`)
  }

  function openCancelDialog(appointment: Appointment) {
    setCancelError(null)
    setToCancel(appointment)
  }

  async function confirmCancel() {
    if (!toCancel) return

    setCancelError(null)
    setIsCancelling(true)

    try {
      const response = await fetch(`/api/appointments/${encodeURIComponent(toCancel.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = (await response.json().catch(() => null)) as AppointmentResponse | null

      if (!response.ok) {
        setCancelError(result?.message ?? 'Não foi possível cancelar o agendamento. Tente novamente.')
        return
      }

      setAppointments((previous) => previous.filter((appointment) => appointment.id !== toCancel.id))
      toast.success('Agendamento cancelado', {
        description: `${toCancel.serviceName ?? 'Serviço'} foi cancelado.`,
      })
      setToCancel(null)
      router.refresh()
    } catch {
      setCancelError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.')
    } finally {
      setIsCancelling(false)
    }
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
            onCancel={() => openCancelDialog(appointment)}
          />
        ))}
      </div>

      <AlertDialog
        open={Boolean(toCancel)}
        onOpenChange={(open) => {
          if (!open && !isCancelling) {
            setCancelError(null)
            setToCancel(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Você poderá agendar um novo horário depois.
            </AlertDialogDescription>
            {cancelError && (
              <p role="alert" className="pt-2 text-sm text-destructive">
                {cancelError}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCancel} disabled={isCancelling}>
              {isCancelling && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              {isCancelling ? 'Cancelando...' : 'Cancelar agendamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
