import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CalendarDays,
  CalendarOff,
  LayoutDashboard,
  Scissors,
  Settings,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { AdminLogoutButton } from '@/components/admin/admin-logout-button'
import { getAuthenticatedAdmin } from '@/lib/admin-auth'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAuthenticatedAdmin()
  if (!admin) redirect('/admin/login')

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-lg text-foreground">Gui Santos</span>
              <span className="text-[10px] font-medium tracking-[0.18em] text-primary">
                ADMINISTRAÇÃO
              </span>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Painel administrativo">
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="size-4" />
              Resumo
            </Link>
            <Link
              href="/admin/agendamentos"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CalendarDays className="size-4" />
              Agenda
            </Link>
            <Link
              href="/admin/bloqueios"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CalendarOff className="size-4" />
              Bloqueios
            </Link>
            <Link
              href="/admin/servicos"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Scissors className="size-4" />
              Serviços
            </Link>
            <Link
              href="/admin/barbeiros"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <UsersRound className="size-4" />
              Barbeiros
            </Link>
            <Link
              href="/admin/configuracoes"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-4" />
              Configurações
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{admin.name}</span>
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
