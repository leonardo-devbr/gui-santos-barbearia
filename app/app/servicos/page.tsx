import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ServiceCard } from '@/components/service-card'
import { services, categoryLabels } from '@/data/services'
import type { Service } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Serviços | Gui Santos Barbearia',
}

const categoryOrder: Service['category'][] = ['cortes', 'barba', 'combos', 'acabamentos']

export default function ServicosPage() {
  const grouped = categoryOrder
    .map((category) => ({
      category,
      items: services.filter((s) => s.category === category),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl text-foreground">Serviços</h1>
        <p className="text-sm text-muted-foreground">
          Escolha um serviço e agende com o barbeiro de sua preferência.
        </p>
      </div>

      {grouped.map((group) => (
        <section key={group.category} className="flex flex-col gap-4">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
            {categoryLabels[group.category]}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {group.items.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/app/agendar?servico=${service.id}`} />}
                    nativeButton={false}
                  >
                    Agendar
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
