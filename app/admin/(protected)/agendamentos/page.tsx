import type { Metadata } from 'next'
import { AdminAppointmentsList } from '@/components/admin/admin-appointments-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminAppointments } from '@/lib/admin-appointments'
import { getTodayInSaoPaulo, isValidIsoDate } from '@/lib/date'
import { formatDateLong } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Agenda administrativa | Gui Santos Barbearia',
}

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const requestedDate = (await searchParams).date?.trim() ?? ''
  const date = isValidIsoDate(requestedDate) ? requestedDate : getTodayInSaoPaulo()
  const appointments = await getAdminAppointments(date)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-[0.2em] text-primary">OPERAÇÃO</span>
          <h1 className="font-serif text-3xl text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">{formatDateLong(date)}</p>
        </div>

        <form className="flex items-end gap-2" action="/admin/agendamentos">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Escolher data
            <Input name="date" type="date" defaultValue={date} className="w-auto" />
          </label>
          <Button type="submit" variant="outline">
            Visualizar
          </Button>
        </form>
      </div>

      <AdminAppointmentsList initial={appointments} />
    </div>
  )
}
