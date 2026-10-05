const mapsEmbedEndpoint = 'https://www.google.com/maps/embed/v1/place'
const mapsDirectionsEndpoint = 'https://www.google.com/maps/dir/'

interface GoogleMapsEmbedOptions {
  apiKey?: string
  latitude: number
  longitude: number
}

function getCoordinateQuery(latitude: number, longitude: number) {
  return `${latitude},${longitude}`
}

export function getGoogleMapsEmbedUrl({
  apiKey,
  latitude,
  longitude,
}: GoogleMapsEmbedOptions) {
  const normalizedApiKey = apiKey?.trim()
  if (!normalizedApiKey) return null

  const url = new URL(mapsEmbedEndpoint)
  url.searchParams.set('key', normalizedApiKey)
  url.searchParams.set('q', getCoordinateQuery(latitude, longitude))
  url.searchParams.set('zoom', '16')
  url.searchParams.set('maptype', 'roadmap')
  url.searchParams.set('language', 'pt-BR')
  url.searchParams.set('region', 'br')

  return url.toString()
}

export function getGoogleMapsDirectionsUrl(latitude: number, longitude: number) {
  const url = new URL(mapsDirectionsEndpoint)
  url.searchParams.set('api', '1')
  url.searchParams.set('destination', getCoordinateQuery(latitude, longitude))

  return url.toString()
}
