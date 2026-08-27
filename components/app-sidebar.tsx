'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarPlus,
  CalendarCheck,
  History,
  Scissors,
  Users,
  Gem,
  User,
  Settings,
  LogOut,
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/app', label: 'Início', icon: LayoutGrid },
  { href: '/app/agendar', label: 'Agendar', icon: CalendarPlus },
  { href: '/app/agendamentos', label: 'Agendamentos', icon: CalendarCheck },
  { href: '/app/historico', label: 'Histórico', icon: History },
  { href: '/app/servicos', label: 'Serviços', icon: Scissors },
  { href: '/app/barbeiros', label: 'Barbeiros', icon: Users },
  { href: '/app/perfil', label: 'Perfil', icon: User },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-sidebar-border lg:bg-sidebar lg:shrink-0">
      <div className="flex flex-col gap-0.5 px-6 py-8">
        <span className="font-serif text-xl tracking-wide text-sidebar-foreground">GUI SANTOS</span>
        <span className="text-xs font-medium tracking-[0.2em] text-primary">BARBEARIA</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-primary font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-sidebar-border px-3 py-4">
        <Link
          href="/app/perfil"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Settings className="size-4" />
          Configurações
        </Link>
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="size-4" />
          Sair
        </Link>
      </div>
    </aside>
  )
}
