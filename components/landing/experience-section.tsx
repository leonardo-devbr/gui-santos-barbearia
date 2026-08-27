import Image from 'next/image'

export function ExperienceSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-5">
          <span className="text-xs font-medium tracking-[0.3em] text-primary">A EXPERIÊNCIA</span>
          <h2 className="font-serif text-balance text-4xl text-foreground sm:text-5xl">
            Um ambiente feito para o seu momento
          </h2>
         
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative col-span-2 aspect-[16/10] overflow-hidden rounded-xl">
            <Image
              src="/images/hero-barbershop.png"
              alt="Ambiente interno da Gui Santos Barbearia"
              fill
              className="object-cover"
            />
          </div>
          <div className="relative aspect-square overflow-hidden rounded-xl">
            
          </div>
        </div>
      </div>
    </section>
  )
}
