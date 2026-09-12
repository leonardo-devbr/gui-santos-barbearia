import type { Metadata } from 'next'
import { AdminScheduleBlocks } from '@/components/admin/admin-schedule-blocks'
import { getAdminScheduleBlocks } from '@/lib/admin-schedule-blocks'
import { getBarbers } from '@/lib/catalog'
import { getTodayInSaoPaulo } from '@/lib/date'

export const metadata: Metadata = {
  title: 'Bloqueios de agenda | Gui Santos Barbearia',
}

export default async function AdminScheduleBlocksPage() {
  const [blocks, barbers] = await Promise.all([getAdminScheduleBlocks(), getBarbers()])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">DISPONIBILIDADE</span>
        <h1 className="font-serif text-3xl text-foreground">Bloqueios de agenda</h1>
        <p className="text-sm text-muted-foreground">
          Controle folgas, pausas, feriados e períodos sem atendimento.
        </p>
      </div>

      <AdminScheduleBlocks
        initial={blocks}
        barbers={barbers}
        today={getTodayInSaoPaulo()}
      />
    </div>
  )
}
