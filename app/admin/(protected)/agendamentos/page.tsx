import type { Metadata } from 'next'
import { AdminAgenda } from '@/components/admin/admin-agenda'
import { getAgendaPeriod, isAgendaView } from '@/lib/admin-agenda'
import { getAdminAppointmentsForPeriod } from '@/lib/admin-appointments'
import { requireStaffPageAccess } from '@/lib/admin-page-access'
import { getBarbers } from '@/lib/catalog'
import { getTodayInSaoPaulo, isValidIsoDate } from '@/lib/date'

export const metadata: Metadata = {
  title: 'Agenda da equipe | Gui Santos Barbearia',
}

type SearchValue = string | string[] | undefined

function readSearchValue(value: SearchValue) {
  return typeof value === 'string' ? value.trim() : ''
}

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchValue>>
}) {
  const staff = await requireStaffPageAccess()
  const params = await searchParams
  const requestedView = readSearchValue(params.view)
  const view = isAgendaView(requestedView) ? requestedView : 'day'
  const requestedDate = readSearchValue(params.date)
  const referenceDate = isValidIsoDate(requestedDate) ? requestedDate : getTodayInSaoPaulo()
  const period = getAgendaPeriod(referenceDate, view)
  const barbers = staff.role === 'admin' ? await getBarbers() : []
  const requestedBarberId = readSearchValue(params.barber)
  const barberId = barbers.some((barber) => barber.id === requestedBarberId)
    ? requestedBarberId
    : ''
  const appointments = await getAdminAppointmentsForPeriod(
    period.startDate,
    period.endDate,
    barberId || undefined,
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">OPERAÇÃO</span>
        <h1 className="font-serif text-3xl text-foreground">
          {staff.role === 'admin' ? 'Agenda da equipe' : 'Minha agenda'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Consulte horários por dia, semana ou mês e refine os resultados disponíveis.
        </p>
      </div>

      <AdminAgenda
        key={`${view}-${referenceDate}-${barberId}`}
        initialAppointments={appointments}
        view={view}
        referenceDate={referenceDate}
        startDate={period.startDate}
        endDate={period.endDate}
        barbers={barbers}
        selectedBarberId={barberId}
        isAdmin={staff.role === 'admin'}
      />
    </div>
  )
}
