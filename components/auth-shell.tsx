import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AuthShellProps {
  children: React.ReactNode
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <Image
          src="/images/interior-detail.png"
          alt="Interior da Gui Santos Barbearia"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-background/10" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-12">
          <span className="font-serif text-3xl text-foreground">
            Gui Santos <span className="text-primary">Barbearia</span>
          </span>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Tradição e precisão em cada corte. Entre para agendar seu próximo horário.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col gap-5">
            <Button
              render={<Link href="/" />}
              nativeButton={false}
              variant="ghost"
              className="w-fit px-0 text-muted-foreground hover:bg-transparent hover:text-primary"
            >
              <ArrowLeft aria-hidden="true" />
              Voltar para o site
            </Button>
            <Link
              href="/"
              className="flex flex-col items-center gap-1 text-center lg:items-start lg:text-left"
            >
              <span className="font-serif text-2xl tracking-wide text-foreground">GUI SANTOS</span>
              <span className="text-xs font-medium tracking-[0.3em] text-primary">BARBEARIA</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
