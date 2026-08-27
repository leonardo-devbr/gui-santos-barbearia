import type { Metadata } from 'next'
import { HistoryList } from '@/components/appointments/history-list'
import { pastAppointments } from '@/data/appointments'
import { formatPrice } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Histórico | Gui Santos Barbearia',
}

export default function HistoricoPage() {
  const completed = pastAppointments.filter((a) => a.status === 'concluido')
  const totalSpent = completed.reduce((sum, a) => sum + a.price, 0)

  return (
    <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl text-foreground">Histórico</h1>
        <p className="text-sm text-muted-foreground">Todos os seus atendimentos anteriores.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            ATENDIMENTOS
          </span>
          <span className="font-serif text-2xl text-foreground">{completed.length}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            TOTAL INVESTIDO
          </span>
          <span className="font-serif text-2xl text-primary">{formatPrice(totalSpent)}</span>
        </div>
      </div>

      <HistoryList appointments={pastAppointments} />
    </div>
  )
}
