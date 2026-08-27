import Link from 'next/link'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { barbers } from '@/data/barbers'

export function BarbersSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-[0.3em] text-primary">NOSSA EQUIPE</span>
        <h2 className="font-serif text-balance text-4xl text-foreground sm:text-5xl">Barbeiros</h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        {barbers.map((barber) => (
          <div key={barber.id} className="flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card">
            <div className="relative aspect-[4/5] w-full">
              <Image
                src={barber.photoUrl || '/placeholder.svg'}
                alt={`Foto de ${barber.name}`}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-1.5 px-5 pb-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-lg text-card-foreground">{barber.name}</h3>
                <span className="flex items-center gap-1 text-sm text-primary">
                  <Star className="size-3.5 fill-primary" />
                  {barber.rating.toFixed(1)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{barber.specialty}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Button variant="outline" render={<Link href="/app/barbeiros" />} nativeButton={false}>
          Conhecer a equipe
        </Button>
      </div>
    </section>
  )
}
