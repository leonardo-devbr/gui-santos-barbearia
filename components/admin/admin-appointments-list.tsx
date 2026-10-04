'use client'

import { useState } from 'react'
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

export function AdminAppointmentsList({ initial }: { initial: AdminAppointment[] }) {
  const [appointments, setAppointments] = useState(initial)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function updateStatus(
    appointment: AdminAppointment,
    status: Extract<AppointmentStatus, 'concluido' | 'cancelado'>,
  ) {
    if (status === 'cancelado' && !window.confirm('Cancelar este agendamento?')) return

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

      setAppointments((current) =>
        current.map((item) => (item.id === appointment.id ? { ...item, status } : item)),
      )
      toast.success(status === 'concluido' ? 'Atendimento concluído.' : 'Agendamento cancelado.')
    } catch {
      toast.error('Não foi possível conectar ao servidor.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (appointments.length === 0) {
    return (
      <Empty className="rounded-2xl border border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Clock />
          </EmptyMedia>
          <EmptyTitle>Nenhum horário nesta data</EmptyTitle>
          <EmptyDescription>A agenda está livre para o dia selecionado.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {appointments.map((appointment) => {
        const isUpdating = updatingId === appointment.id
        const isOpen = appointment.status === 'confirmado' || appointment.status === 'pendente'

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
                {isOpen && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void updateStatus(appointment, 'concluido')}
                      disabled={Boolean(updatingId)}
                    >
                      {isUpdating ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
                      Concluir
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void updateStatus(appointment, 'cancelado')}
                      disabled={Boolean(updatingId)}
                    >
                      <XCircle />
                      Cancelar
                    </Button>
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
