import Link from 'next/link'
import { Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
          <Scissors className="size-6" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-xs font-medium tracking-[0.3em] text-primary">ERRO 404</span>
          <h1 className="font-serif text-4xl text-foreground sm:text-5xl">Página não encontrada</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            O endereço acessado não existe ou foi movido. Volte ao início para continuar navegando.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button render={<Link href="/" />} nativeButton={false}>
            Voltar ao início
          </Button>
          <Button variant="outline" render={<Link href="/login" />} nativeButton={false}>
            Entrar na minha conta
          </Button>
        </div>
      </div>
    </main>
  )
}
