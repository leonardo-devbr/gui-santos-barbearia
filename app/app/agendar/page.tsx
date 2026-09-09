import type { Metadata } from 'next'
import { BookingFlow } from '@/components/booking/booking-flow'

export const metadata: Metadata = {
  title: 'Agendar horário | Gui Santos Barbearia',
}

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ agendamento?: string; servico?: string; barbeiro?: string }>
}) {
  const { agendamento, servico, barbeiro } = await searchParams
  const isRescheduling = Boolean(agendamento)

  return (
    <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl text-foreground">
          {isRescheduling ? 'Remarcar horário' : 'Agendar horário'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isRescheduling ? 'Escolha uma nova opção para seu atendimento.' : 'Monte seu atendimento em poucos passos.'}
        </p>
      </div>

      <BookingFlow appointmentId={agendamento} initialServiceId={servico} initialBarberId={barbeiro} />
    </div>
  )
}
