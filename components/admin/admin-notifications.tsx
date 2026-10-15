'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { StaffNotification } from '@/lib/types'

interface NotificationsResponse {
  notifications: StaffNotification[]
  unreadCount: number
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`
  if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)} h`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function AdminNotifications() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NotificationsResponse>({ notifications: [], unreadCount: 0 })
  const [loading, setLoading] = useState(true)

  async function loadNotifications(silent = false) {
    if (!silent) setLoading(true)
    try {
      const response = await fetch('/api/admin/notifications', { credentials: 'include', cache: 'no-store' })
      if (!response.ok) return
      const next = (await response.json()) as NotificationsResponse
      setData(next)
    } catch {
      // Falhas de polling não interrompem o painel.
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
    const interval = window.setInterval(() => void loadNotifications(true), 15_000)
    return () => window.clearInterval(interval)
  }, [])

  async function markRead(id: string) {
    const response = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    })
    if (!response.ok) return
    setData((current) => ({
      notifications: current.notifications.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
      unreadCount: Math.max(0, current.unreadCount - 1),
    }))
  }

  async function markAllRead() {
    const response = await fetch('/api/admin/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ all: true }),
    })
    if (!response.ok) {
      toast.error('Não foi possível marcar as notificações como lidas.')
      return
    }
    setData((current) => ({
      notifications: current.notifications.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
      unreadCount: 0,
    }))
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative"
      >
        <Bell />
        {data.unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-medium text-card-foreground">Notificações</p>
              <p className="text-xs text-muted-foreground">Atualização automática a cada 15 segundos</p>
            </div>
            {data.unreadCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void markAllRead()}>
                <Check />
                Ler todas
              </Button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Carregando...
              </div>
            ) : data.notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma notificação por enquanto.
              </div>
            ) : (
              data.notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => !notification.readAt && void markRead(notification.id)}
                  className={cn(
                    'flex w-full gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/60',
                    !notification.readAt && 'bg-primary/5',
                  )}
                >
                  <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', notification.readAt ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
                    <Bell className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-card-foreground">{notification.title}</span>
                      {!notification.readAt && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-muted-foreground">{notification.message}</span>
                    <span className="mt-2 block text-[11px] text-muted-foreground">{formatRelativeDate(notification.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
