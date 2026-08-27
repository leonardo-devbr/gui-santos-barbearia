import type { Metadata } from 'next'
import { NextAppointmentCard } from '@/components/dashboard/next-appointment-card'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { BookAgainCard } from '@/components/dashboard/book-again-card'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { CalendarPlus } from 'lucide-react'
import Link from 'next/link'
import { currentCustomer } from '@/data/customer'
import { upcomingAppointments, pastAppointments } from '@/data/appointments'

export const metadata: Metadata = {
  title: 'Minha Área | Gui Santos Barbearia',
}

export default function DashboardPage() {
  const nextAppointment = upcomingAppointments[0]
  const lastAppointment = pastAppointments.find((a) => a.status === 'concluido')
  const firstName = currentCustomer.name.split(' ')[0]

  return (
    <div className="flex flex-col gap-10 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl text-foreground">Olá, {firstName}</h1>
        <p className="text-sm text-muted-foreground">Pronto para cuidar do visual?</p>
      </div>

      {nextAppointment ? (
        <NextAppointmentCard appointment={nextAppointment} />
      ) : (
        <Empty className="rounded-2xl border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarPlus />
            </EmptyMedia>
            <EmptyTitle>Você ainda não possui agendamentos.</EmptyTitle>
            <EmptyDescription>Que tal cuidar do visual?</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/app/agendar" />} nativeButton={false}>
              Agendar horário
            </Button>
          </EmptyContent>
        </Empty>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">Ações rápidas</h2>
        <QuickActions />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
       
        {lastAppointment && <BookAgainCard lastAppointment={lastAppointment} />}
      </div>
    </div>
  )
}
