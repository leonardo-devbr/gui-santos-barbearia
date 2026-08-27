import Link from 'next/link'
import { Scissors, Sparkles, Layers, Eye, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { services } from '@/data/services'
import { formatPrice } from '@/lib/format'

const serviceIcons: Record<string, typeof Scissors> = {
  corte: Scissors,
  barba: Wand2,
  'corte-barba': Layers,
  sobrancelha: Eye,
  acabamento: Sparkles,
  'corte-infantil': Scissors,
}

export function ServicesSection() {
  const featured = services.slice(0, 5)

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-[0.3em] text-primary">O QUE OFERECEMOS</span>
        <h2 className="font-serif text-balance text-4xl text-foreground sm:text-5xl">Serviços</h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {featured.map((service) => {
          const Icon = serviceIcons[service.id] ?? Scissors
          return (
            <div
              key={service.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <Icon className="size-6 text-primary" />
              <div className="flex flex-col gap-1">
                <h3 className="font-serif text-lg text-card-foreground">{service.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
              </div>
              <span className="mt-auto font-serif text-xl text-primary">{formatPrice(service.price)}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-10">
        <Button variant="outline" render={<Link href="/app/servicos" />} nativeButton={false}>
          Ver todos os serviços
        </Button>
      </div>
    </section>
  )
}
