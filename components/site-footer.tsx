import Link from "next/link"
import { MapPin, Phone, Clock } from "lucide-react"
import { getBusinessConfiguration } from '@/lib/business'
import { formatBusinessHour, formatCnpj, getWeekdayLabel } from '@/lib/business-labels'
import { formatPhone } from '@/lib/validation'

export async function SiteFooter() {
  const { settings, hours } = await getBusinessConfiguration()

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <span className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              {settings.name}
            </span>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tradição e precisão em cada corte. Uma experiência de barbearia
              feita para quem exige o melhor.
            </p>
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
              <span>
                {settings.street} — {settings.district}, {settings.city}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-4 shrink-0 text-primary" />
              <a href={`tel:+55${settings.phone}`} className="transition-colors hover:text-primary">
                {formatPhone(settings.phone)}
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="font-serif text-sm font-semibold uppercase tracking-wider text-foreground">
              Horário
            </h3>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                {hours.map((hour) => (
                  <span key={hour.weekday}>
                    {getWeekdayLabel(hour.weekday)}:{' '}
                    {formatBusinessHour(hour).toLocaleLowerCase('pt-BR')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-xs text-muted-foreground sm:flex-row">
          <span>© 2026 {settings.name}. Todos os direitos reservados.</span>
          {settings.cnpj && <span>CNPJ {formatCnpj(settings.cnpj)}</span>}
        </div>
      </div>
    </footer>
  )
}
