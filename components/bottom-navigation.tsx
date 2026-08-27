'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, CalendarPlus, CalendarCheck, Gem, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/app', label: 'Início', icon: LayoutGrid },
  { href: '/app/agendar', label: 'Agendar', icon: CalendarPlus },
  { href: '/app/agendamentos', label: 'Agenda', icon: CalendarCheck },
  { href: '/app/perfil', label: 'Perfil', icon: User },
]

export function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden">
      <div className="grid grid-cols-5">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-3 text-[11px] transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('size-5', isActive && 'fill-primary/15')} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
