import Image from 'next/image'

export function ExperienceSection() {
  return (
    <section className="relative isolate flex min-h-[34rem] w-full items-end overflow-hidden md:min-h-[40rem]">
      <Image
        src="/images/WhatsApp%20Image%202026-09-01%20at%2023.12.27.jpeg"
        alt="Interior da Gui Santos Barbearia, com poltronas e mesa de sinuca"
        fill
        sizes="100vw"
        className="-z-10 object-cover object-[center_58%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10 md:bg-gradient-to-r md:from-black/85 md:via-black/45 md:to-black/10"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.72)_100%)]"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 pb-12 pt-40 md:pb-16">
        <span className="text-xs font-medium tracking-[0.3em] text-primary">A EXPERIÊNCIA</span>
        <h2 className="max-w-2xl font-serif text-balance text-4xl text-foreground sm:text-5xl md:text-6xl">
          Um ambiente feito para o seu momento
        </h2>
      </div>
    </section>
  )
}
