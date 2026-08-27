import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex flex-col leading-none">
          <span className="font-serif text-lg tracking-wide text-foreground">GUI SANTOS</span>
          <span className="text-[10px] font-medium tracking-[0.25em] text-primary">BARBEARIA</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            render={<Link href="/login" />}
            nativeButton={false}
            className="inline-flex"
          >
            Entrar
          </Button>
          <Button render={<Link href="/app/agendar" />} nativeButton={false}>
            Agendar horário
          </Button>
        </div>
      </div>
    </header>
  )
}
