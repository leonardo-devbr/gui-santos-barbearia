import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="relative flex min-h-[92vh] items-end overflow-hidden">
      <Image
        src="/images/hero-barbershop.png"
        alt="Interior premium da Gui Santos Barbearia, com paredes grafite e iluminação dourada"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-20 pt-32">
        <span className="text-xs font-medium tracking-[0.3em] text-primary">
          BARBEARIA PREMIUM
        </span>
        <h1 className="font-serif text-balance text-6xl leading-[0.95] text-foreground sm:text-7xl lg:text-8xl">
          GUI SANTOS
          <br />
          <span className="text-primary">BARBEARIA</span>
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">Seu estilo. Seu momento.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="lg" render={<Link href="/app/agendar" />} nativeButton={false} className="h-12 px-6 text-base">
            Agendar horário
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<Link href="/app/servicos" />}
            nativeButton={false}
            className="h-12 px-6 text-base"
          >
            Conhecer serviços
          </Button>
        </div>
      </div>
    </section>
  )
}
