import { ExternalLink, MapPin } from 'lucide-react'
import {
  getGoogleMapsDirectionsUrl,
  getGoogleMapsEmbedUrl,
} from '@/lib/google-maps'

interface LocationMapProps {
  name: string
  street: string
  latitude: number
  longitude: number
}

export function LocationMap({
  name,
  street,
  latitude,
  longitude,
}: LocationMapProps) {
  const embedUrl = getGoogleMapsEmbedUrl({
    apiKey: process.env.GOOGLE_MAPS_EMBED_API_KEY,
    latitude,
    longitude,
  })
  const directionsUrl = getGoogleMapsDirectionsUrl(latitude, longitude)

  if (!embedUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-card px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MapPin className="size-6" aria-hidden="true" />
        </span>
        <div className="max-w-sm space-y-1">
          <p className="font-serif text-xl text-card-foreground">{name}</p>
          <p className="text-sm text-muted-foreground">{street}</p>
          <p className="pt-2 text-xs text-muted-foreground">
            O mapa interativo está temporariamente indisponível.
          </p>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Abrir rota no Google Maps
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    )
  }

  return (
    <iframe
      title={`Mapa da ${name}`}
      src={embedUrl}
      className="h-full w-full border-0"
      loading="lazy"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
