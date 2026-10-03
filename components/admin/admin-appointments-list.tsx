'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, LoaderCircle, Mail, Phone, Scissors, UserRound, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { formatPrice } from '@/lib/format'
import { formatPhone } from '@/lib/validation'
import type { AdminAppointment, AppointmentStatus } from '@/lib/types'

interface ApiResponse {
  message?: string
}

export function AdminAppointmentsList({
  appointments,
  initial,
  onStatusChange,
  emptyTitle = 'Nenhum horário neste período',
  emptyDescription = 'Não há agendamentos para os filtros selecionados.',
}: {
  appointments?: AdminAppointment[]
  initial?: AdminAppointment[]
  onStatusChange?: (
    appointmentId: string,
    status: Extract<AppointmentStatus, 'concluido' | 'cancelado'>,
  ) => void
  emptyTitle?: string
  emptyDescription?: string
}) {
  const router = useRouter()
  const [localAppointments, setLocalAppointments] = useState(initial ?? [])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const visibleAppointments = appointments ?? localAppointments

  async function updateStatus(
    appointment: AdminAppointment,
    status: Extract<AppointmentStatus, 'concluido' | 'cancelado'>,
  ) {
    const isNoShow = status === 'cancelado' && appointment.canComplete
    if (
      status === 'cancelado' &&
      !window.confirm(
        isNoShow ? 'Marcar este atendimento como não realizado?' : 'Cancelar este agendamento?',
      )
    ) {
      return
    }

    setUpdatingId(appointment.id)

    try {
      const response = await fetch(`/api/admin/appointments/${encodeURIComponent(appointment.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      const result = (await response.json().catch(() => null)) as ApiResponse | null

      if (!response.ok) {
        toast.error(result?.message ?? 'Não foi possível atualizar o agendamento.')
        return
      }

      if (onStatusChange) {
        onStatusChange(appointment.id, status)
      } else {
        setLocalAppointments((current) =>
          current.map((item) =>
            item.id === appointment.id
              ? { ...item, status, canComplete: false, canCancel: false }
              : item,
          ),
        )
      }
      toast.success(
        status === 'concluido'
          ? 'Atendimento concluído.'
          : isNoShow
            ? 'Atendimento marcado como não realizado.'
            : 'Agendamento cancelado.',
      )
      router.refresh()
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (visibleAppointments.length === 0) {
    return (
      <Empty className="rounded-2xl border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {visibleAppointments.map((appointment) => {
        const isUpdating = updatingId === appointment.id
        const hasActions = appointment.canComplete || appointment.canCancel

        return (
          <Card key={appointment.id}>
            <CardContent className="grid gap-5 lg:grid-cols-[100px_1fr_auto] lg:items-center">
              <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-1">
                <span className="font-serif text-2xl text-primary">{appointment.time}</span>
                <span className="text-xs text-muted-foreground">{appointment.durationMinutes} min</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-primary" />
                    <span className="font-medium text-card-foreground">{appointment.customerName}</span>
                  </div>
                  <a
                    href={`tel:${appointment.customerPhone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    <Phone className="size-3.5" />
                    {formatPhone(appointment.customerPhone)}
                  </a>
                  <a
                    href={`mailto:${appointment.customerEmail}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                  >
                    <Mail className="size-3.5" />
                    {appointment.customerEmail}
                  </a>
                </div>

                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2 text-card-foreground">
                    <Scissors className="size-4 text-primary" />
                    {appointment.serviceName}
                  </span>
                  <span>Barbeiro: {appointment.barberName}</span>
                  <span>{formatPrice(appointment.price)}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:max-w-48 lg:justify-end">
                <StatusBadge status={appointment.status} />
                {hasActions && (
                  <>
                    {appointment.canComplete && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void updateStatus(appointment, 'concluido')}
                        disabled={Boolean(updatingId)}
                      >
                        {isUpdating ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
                        Concluir
                      </Button>
                    )}
                    {appointment.canCancel && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void updateStatus(appointment, 'cancelado')}
                        disabled={Boolean(updatingId)}
                      >
                        <XCircle />
                        {appointment.canComplete ? 'Não realizado' : 'Cancelar'}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
