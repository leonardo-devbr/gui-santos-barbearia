import type { Metadata } from 'next'
import { BookingFlow } from '@/components/booking/booking-flow'

export const metadata: Metadata = {
  title: 'Agendar horário | Gui Santos Barbearia',
}

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ servico?: string; barbeiro?: string }>
}) {
  const { servico, barbeiro } = await searchParams

  return (
    <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl text-foreground">Agendar horário</h1>
        <p className="text-sm text-muted-foreground">
          Monte seu atendimento em poucos passos.
        </p>
      </div>

      <BookingFlow initialServiceId={servico} initialBarberId={barbeiro} />
    </div>
  )
}
