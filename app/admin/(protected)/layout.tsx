import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CalendarDays,
  CalendarOff,
  LayoutDashboard,
  Scissors,
  Settings,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react'
import { AdminLogoutButton } from '@/components/admin/admin-logout-button'
import { getAuthenticatedStaff } from '@/lib/admin-auth'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await getAuthenticatedStaff()
  if (!staff) redirect('/admin/login')
  const isAdmin = staff.role === 'admin'

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
                {isAdmin ? 'ADMINISTRAÇÃO' : 'ÁREA DO BARBEIRO'}
              </span>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Painel da equipe">
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="size-4" />
              {isAdmin ? 'Resumo' : 'Meu dia'}
            </Link>
            <Link
              href="/admin/agendamentos"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CalendarDays className="size-4" />
              {isAdmin ? 'Agenda' : 'Minha agenda'}
            </Link>
            <Link
              href="/admin/bloqueios"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CalendarOff className="size-4" />
              {isAdmin ? 'Bloqueios' : 'Meus bloqueios'}
            </Link>
            {isAdmin && (
              <>
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
                <Link
                  href="/admin/administradores"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <UserCog className="size-4" />
                  Acessos
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{staff.name}</span>
            <AdminLogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
