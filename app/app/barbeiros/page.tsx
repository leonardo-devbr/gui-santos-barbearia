import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BarberCard } from '@/components/barber-card'
import { barbers } from '@/data/barbers'

export const metadata: Metadata = {
  title: 'Barbeiros | Gui Santos Barbearia',
}

export default function BarbeirosPage() {
  return (
    <div className="flex flex-col gap-8 px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-3xl text-foreground">Barbeiros</h1>
        <p className="text-sm text-muted-foreground">
          Conheça o time e agende com quem combina com o seu estilo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {barbers.map((barber) => (
          <BarberCard
            key={barber.id}
            barber={barber}
            showRating={false}
            action={
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  render={<Link href={`/app/agendar?barbeiro=${barber.id}`} />}
                  nativeButton={false}
                >
                  Agendar
                </Button>
              </div>
            }
          />
        ))}
      </div>
    </div>
  )
}
