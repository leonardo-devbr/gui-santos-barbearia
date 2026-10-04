import Link from 'next/link'
import { CalendarPlus, CalendarCheck, History, User } from 'lucide-react'

const actions = [
  { href: '/app/agendar', label: 'Agendar horário', icon: CalendarPlus },
  { href: '/app/agendamentos', label: 'Meus agendamentos', icon: CalendarCheck },
  { href: '/app/historico', label: 'Histórico', icon: History },
  { href: '/app/perfil', label: 'Meu perfil', icon: User },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-card-foreground">{action.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
