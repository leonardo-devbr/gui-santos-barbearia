import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AppointmentStatus } from '@/lib/types'

const statusConfig: Record<AppointmentStatus, { label: string; className: string }> = {
  confirmado: {
    label: 'Confirmado',
    className: 'bg-success/15 text-success border-success/30',
  },
  pendente: {
    label: 'Pendente',
    className: 'bg-primary/15 text-primary border-primary/30',
  },
  concluido: {
    label: 'Concluído',
    className: 'bg-muted text-muted-foreground border-border',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-destructive/15 text-destructive border-destructive/30',
  },
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const config = statusConfig[status]
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  )
}
