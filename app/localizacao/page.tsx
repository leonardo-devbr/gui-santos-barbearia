import type { Metadata } from 'next'
import Link from 'next/link'
import { MapPin, Phone, Clock, Mail, Car, TramFront } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { LocationMapLoader } from '@/components/location-map-loader'
import { getLoginHref } from '@/lib/navigation'
import { getBusinessConfiguration } from '@/lib/business'
import { formatBusinessHour, formatPostalCode, getWeekdayLabel } from '@/lib/business-labels'
import { formatPhone } from '@/lib/validation'

export const metadata: Metadata = {
  title: 'Localização | Gui Santos Barbearia',
  description: 'Encontre a Gui Santos Barbearia. Endereço, horário de funcionamento e como chegar.',
}

export default async function LocationPage() {
  const { settings, hours } = await getBusinessConfiguration()

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10">
          <span className="text-xs font-medium tracking-[0.3em] text-primary">VISITE-NOS</span>
          <h1 className="mt-3 font-serif text-balance text-4xl text-foreground sm:text-5xl">
            Localização
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Estamos no coração do {settings.district}, com fácil acesso e estrutura para receber você.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 pb-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="h-[420px] overflow-hidden rounded-xl border border-border lg:h-[560px]">
            <LocationMapLoader settings={settings} />
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-lg text-card-foreground">Endereço</h3>
                  <p className="text-sm text-muted-foreground">
                    {settings.street} — {settings.district}
                    <br />
                    {settings.city}, {settings.state} — CEP {formatPostalCode(settings.postalCode)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-lg text-card-foreground">Telefone</h3>
                  <a href={`tel:+55${settings.phone}`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {formatPhone(settings.phone)}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-lg text-card-foreground">E-mail</h3>
                  <a href={`mailto:${settings.email}`} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                    {settings.email}
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <Clock className="size-5 shrink-0 text-primary" />
                <h3 className="font-serif text-lg text-card-foreground">Horário de funcionamento</h3>
              </div>
              <div className="flex flex-col gap-2">
                {hours.map((hour) => (
                  <div key={hour.weekday} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{getWeekdayLabel(hour.weekday)}</span>
                    <span className="font-medium text-card-foreground">{formatBusinessHour(hour)}</span>
                  </div>
                ))}
              </div>
            </div>

            {(settings.parkingInfo || settings.transitInfo) && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
                {settings.parkingInfo && (
                  <div className="flex items-center gap-3">
                    <Car className="size-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">{settings.parkingInfo}</p>
                  </div>
                )}
                {settings.transitInfo && (
                  <div className="flex items-center gap-3">
                    <TramFront className="size-5 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">{settings.transitInfo}</p>
                  </div>
                )}
              </div>
            )}

            <Button size="lg" render={<Link href={getLoginHref('/app/agendar')} />} nativeButton={false}>
              Agendar horário
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
