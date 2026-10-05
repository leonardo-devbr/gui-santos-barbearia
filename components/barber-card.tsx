import Image from 'next/image'
import { MessageCircle, Phone, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Barber } from '@/lib/types'
import { formatPhone } from '@/lib/validation'

interface BarberCardProps {
  barber: Barber
  selected?: boolean
  onSelect?: () => void
  compact?: boolean
  showRating?: boolean
  action?: React.ReactNode
}

export function BarberCard({ barber, selected, onSelect, compact, showRating = true, action }: BarberCardProps) {
  const interactive = Boolean(onSelect)

  return (
    <Card
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? Boolean(selected) : undefined}
      onClick={onSelect}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect?.()
              }
            }
          : undefined
      }
      className={cn(
        'overflow-hidden p-0 transition-colors',
        interactive && 'cursor-pointer hover:border-primary/50',
        selected && 'border-primary ring-1 ring-primary',
      )}
    >
      <CardContent className="p-0">
        <div className={cn('relative w-full', compact ? 'aspect-[4/3]' : 'aspect-square')}>
          <Image
            src={barber.photoUrl || '/placeholder.svg'}
            alt={`Foto de ${barber.name}`}
            fill
            className="object-cover"
            style={{ objectPosition: `${barber.photoPositionX}% ${barber.photoPositionY}%` }}
          />
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-base text-card-foreground">{barber.name}</h3>
            {showRating && (
              <div className="flex items-center gap-1 text-sm text-primary">
                <Star className="size-3.5 fill-primary" />
                {barber.rating.toFixed(1)}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{barber.specialty}</p>
          {!compact && (
            <>
              <p className="line-clamp-3 pt-1 text-sm leading-relaxed text-muted-foreground">
                {barber.bio}
              </p>
              {barber.phone && !interactive && (
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-sm">
                  <a
                    href={`tel:+55${barber.phone}`}
                    className="inline-flex items-center gap-1.5 text-primary transition-colors hover:text-primary/80"
                  >
                    <Phone className="size-4" aria-hidden="true" />
                    {formatPhone(barber.phone)}
                  </a>
                  <a
                    href={`https://wa.me/55${barber.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary transition-colors hover:text-primary/80"
                    aria-label={`Conversar com ${barber.name} pelo WhatsApp`}
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    WhatsApp
                  </a>
                </div>
              )}
              {action}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
