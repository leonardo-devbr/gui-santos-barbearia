import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/format'
import type { Service } from '@/lib/types'

interface ServiceCardProps {
  service: Service
  selected?: boolean
  onSelect?: () => void
  action?: React.ReactNode
}

export function ServiceCard({ service, selected, onSelect, action }: ServiceCardProps) {
  const interactive = Boolean(onSelect)

  return (
    <Card
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect?.()
            }
          : undefined
      }
      className={cn(
        'transition-colors',
        interactive && 'cursor-pointer hover:border-primary/50',
        selected && 'border-primary ring-1 ring-primary',
      )}
    >
      <CardContent className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-serif text-lg text-card-foreground">{service.name}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" />
            {service.durationMinutes} min
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="font-serif text-lg text-primary">{formatPrice(service.price)}</span>
          {action}
        </div>
      </CardContent>
    </Card>
  )
}
