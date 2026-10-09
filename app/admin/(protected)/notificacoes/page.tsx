import type { Metadata } from 'next'
import Link from 'next/link'
import { BellRing, Filter, MessageCircleMore } from 'lucide-react'
import { AdminWhatsAppProcessButton } from '@/components/admin/admin-whatsapp-process-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  type AdminWhatsAppAudience,
  type AdminWhatsAppEvent,
  type AdminWhatsAppStatus,
  getAdminWhatsAppNotifications,
  parseAdminWhatsAppFilters,
} from '@/lib/admin-whatsapp-notifications'
import { requireAdminPageAccess } from '@/lib/admin-page-access'

export const metadata: Metadata = {
  title: 'Avisos do WhatsApp | Gui Santos Barbearia',
}

type SearchValue = string | string[] | undefined

const statusLabels: Record<AdminWhatsAppStatus, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  previewed: 'Prévia local',
  accepted: 'Aceito pela Meta',
  sent: 'Enviado',
  delivered: 'Entregue',
  read: 'Lido',
  failed: 'Falhou',
  skipped: 'Ignorado',
  superseded: 'Substituído',
}

const eventLabels: Record<AdminWhatsAppEvent, string> = {
  appointment_created: 'Agendamento criado',
  appointment_rescheduled: 'Agendamento remarcado',
  appointment_cancelled: 'Agendamento cancelado',
  reminder_24h: 'Lembrete de 24 horas',
  reminder_2h: 'Lembrete de 2 horas',
}

const audienceLabels: Record<AdminWhatsAppAudience, string> = {
  customer: 'Cliente',
  barber: 'Barbeiro',
  admin: 'Administração',
}

const statusClasses: Record<AdminWhatsAppStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  processing: 'border-blue-500/30 bg-blue-500/10 text-blue-700',
  previewed: 'border-violet-500/30 bg-violet-500/10 text-violet-700',
  accepted: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
  sent: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700',
  delivered: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  read: 'border-green-500/30 bg-green-500/10 text-green-700',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
  skipped: 'border-border bg-muted text-muted-foreground',
  superseded: 'border-border bg-muted text-muted-foreground',
}

export default async function AdminWhatsAppNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchValue>>
}) {
  await requireAdminPageAccess()
  const filters = parseAdminWhatsAppFilters(await searchParams)
  const notifications = await getAdminWhatsAppNotifications(filters)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-[0.2em] text-primary">COMUNICAÇÃO</span>
          <h1 className="font-serif text-3xl text-foreground">Avisos do WhatsApp</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Acompanhe confirmações, cancelamentos e lembretes enviados aos clientes e à equipe.
          </p>
        </div>
        <AdminWhatsAppProcessButton />
      </div>

      <Card>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" action="/admin/notificacoes" method="get">
            <label className="flex min-w-52 flex-1 flex-col gap-1.5 text-sm font-medium">
              Status
              <select
                name="status"
                defaultValue={filters.status ?? ''}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Todos os status</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-52 flex-1 flex-col gap-1.5 text-sm font-medium">
              Evento
              <select
                name="event"
                defaultValue={filters.event ?? ''}
                className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                <option value="">Todos os eventos</option>
                {Object.entries(eventLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="outline" size="lg">
              <Filter /> Filtrar
            </Button>
            {(filters.status || filters.event) && (
              <Button
                render={<Link href="/admin/notificacoes" />}
                nativeButton={false}
                variant="ghost"
                size="lg"
              >
                Limpar filtros
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Histórico recente</h2>
          <p className="text-sm text-muted-foreground">
            {notifications.length} registro(s) encontrado(s), considerando no máximo os 100 mais recentes.
          </p>
        </div>

        {notifications.length === 0 ? (
          <Empty className="border border-border bg-card py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellRing />
              </EmptyMedia>
              <EmptyTitle>Nenhum aviso encontrado</EmptyTitle>
              <EmptyDescription>
                Novos agendamentos e lembretes aparecerão aqui quando forem colocados na fila.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {notifications.map((notification) => (
              <Card key={notification.id}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <MessageCircleMore className="size-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-card-foreground">
                          {eventLabels[notification.event]}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {audienceLabels[notification.audience]} · {notification.recipientName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          WhatsApp {notification.maskedRecipientPhone}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={statusClasses[notification.status]}>
                      {statusLabels[notification.status]}
                    </Badge>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Agendado para</dt>
                      <dd className="font-medium text-foreground">{notification.scheduledFor}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Tentativas</dt>
                      <dd className="font-medium text-foreground">{notification.attempts}</dd>
                    </div>
                  </dl>

                  <details className="rounded-lg border border-border px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium text-foreground">
                      Ver dados do agendamento
                    </summary>
                    <dl className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-2">
                      <div>
                        <dt className="text-xs">Cliente</dt>
                        <dd className="text-foreground">{notification.details.customerName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs">Serviço</dt>
                        <dd className="text-foreground">{notification.details.serviceName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs">Barbeiro</dt>
                        <dd className="text-foreground">{notification.details.barberName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs">Data e horário</dt>
                        <dd className="text-foreground">
                          {notification.details.dateLabel} às {notification.details.time}
                        </dd>
                      </div>
                    </dl>
                  </details>

                  {notification.safeError && (
                    <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      <span className="font-medium">Erro: </span>
                      {notification.safeError}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
