import type { Metadata } from 'next'
import { AdminAppointmentsList } from '@/components/admin/admin-appointments-list'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getAdminAppointments } from '@/lib/admin-appointments'
import { requireStaffPageAccess } from '@/lib/admin-page-access'
import { getBarbers } from '@/lib/catalog'
import { getTodayInSaoPaulo, isValidIsoDate } from '@/lib/date'
import { formatDateLong } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Agenda da equipe | Gui Santos Barbearia',
}

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; barber?: string }>
}) {
  const staff = await requireStaffPageAccess()
  const params = await searchParams
  const requestedDate = params.date?.trim() ?? ''
  const date = isValidIsoDate(requestedDate) ? requestedDate : getTodayInSaoPaulo()
  const barbers = staff.role === 'admin' ? await getBarbers() : []
  const requestedBarberId = params.barber?.trim() ?? ''
  const barberId = barbers.some((barber) => barber.id === requestedBarberId)
    ? requestedBarberId
    : ''
  const appointments = await getAdminAppointments(date, barberId || undefined)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-[0.2em] text-primary">OPERAÇÃO</span>
          <h1 className="font-serif text-3xl text-foreground">
            {staff.role === 'admin' ? 'Agenda da equipe' : 'Minha agenda'}
          </h1>
          <p className="text-sm text-muted-foreground">{formatDateLong(date)}</p>
        </div>

        <form className="flex flex-wrap items-end gap-2" action="/admin/agendamentos">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Escolher data
            <Input name="date" type="date" defaultValue={date} className="w-auto" />
          </label>
          {staff.role === 'admin' && (
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
              Barbeiro
              <select
                name="barber"
                defaultValue={barberId}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Todos</option>
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" variant="outline">
            Visualizar
          </Button>
        </form>
      </div>

      <AdminAppointmentsList initial={appointments} />
    </div>
  )
}
