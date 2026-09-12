import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarCheck, CalendarClock, CheckCircle2, CircleDollarSign } from 'lucide-react'
import { AdminAppointmentsList } from '@/components/admin/admin-appointments-list'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getAdminAppointments, getAdminDashboardMetrics } from '@/lib/admin-appointments'
import { getTodayInSaoPaulo } from '@/lib/date'
import { formatPrice } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Administração | Gui Santos Barbearia',
}

export default async function AdminDashboardPage() {
  const today = getTodayInSaoPaulo()
  const [metrics, appointments] = await Promise.all([
    getAdminDashboardMetrics(),
    getAdminAppointments(today),
  ])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium tracking-[0.2em] text-primary">VISÃO GERAL</span>
        <h1 className="font-serif text-3xl text-foreground">Painel administrativo</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a operação da barbearia e os atendimentos de hoje.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CalendarCheck} label="Agendamentos hoje" value={metrics.appointmentsToday} />
        <MetricCard icon={CheckCircle2} label="Concluídos hoje" value={metrics.completedToday} />
        <MetricCard icon={CalendarClock} label="Próximos 7 dias" value={metrics.upcomingWeek} />
        <MetricCard icon={CircleDollarSign} label="Receita concluída hoje" value={formatPrice(metrics.revenueToday)} />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl text-foreground">Agenda de hoje</h2>
            <p className="text-sm text-muted-foreground">
              {metrics.cancelledToday} cancelamento(s) registrado(s) hoje.
            </p>
          </div>
          <Button render={<Link href={`/admin/agendamentos?date=${today}`} />} nativeButton={false} variant="outline">
            Abrir agenda completa
          </Button>
        </div>
        <AdminAppointmentsList initial={appointments} />
      </section>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarCheck
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="font-serif text-2xl text-card-foreground">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}
