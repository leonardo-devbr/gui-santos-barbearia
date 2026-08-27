import Link from "next/link"
import { MapPin, Phone, Clock, Mail } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              Gui Santos <span className="text-primary">Barbearia</span>
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tradição e precisão em cada corte. Uma experiência de barbearia
              feita para quem exige o melhor.
            </p>
            <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
              <Instagram className="size-4 text-primary" />
              a
              <span></span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-foreground">
              Navegação
            </h3>
            <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Início
            </Link>
            <Link href="/localizacao" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Localização
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Entrar
            </Link>
            <Link href="/cadastro" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              Criar conta
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-foreground">
              Contato
            </h3>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Rua das Palmeiras, 245 — Jardim América, São Paulo</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-4 shrink-0 text-primary" />
              <span>(11) 4002-8899</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-foreground">
              Horário
            </h3>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <span>Terça a sábado: 9h às 20h</span>
                <span>Domingo e segunda: fechado</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row">
          <span>© 2026 Gui Santos Barbearia. Todos os direitos reservados.</span>
          <span>CNPJ 12.345.678/0001-90</span>
        </div>
      </div>
    </footer>
  )
}
