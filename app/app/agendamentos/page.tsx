import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppointmentsList } from '@/components/appointments/appointments-list'
import { upcomingAppointments } from '@/data/appointments'

export const metadata: Metadata = {
  title: 'Meus agendamentos | Gui Santos Barbearia',
}

export default function AgendamentosPage() {
  return (
    <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl text-foreground">Meus agendamentos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe e gerencie seus horários.</p>
        </div>
        <Button render={<Link href="/app/agendar" />} nativeButton={false}>
          Novo agendamento
        </Button>
      </div>

      <AppointmentsList initial={upcomingAppointments} />
    </div>
  )
}
