import { describe, expect, it } from 'vitest'
import {
  getGoogleMapsDirectionsUrl,
  getGoogleMapsEmbedUrl,
} from '@/lib/google-maps'

describe('Google Maps', () => {
  it('não cria o mapa incorporado sem uma chave configurada', () => {
    expect(
      getGoogleMapsEmbedUrl({ apiKey: '  ', latitude: -23.55052, longitude: -46.633308 }),
    ).toBeNull()
  })

  it('cria a URL da Maps Embed API em português com as coordenadas da barbearia', () => {
    const result = getGoogleMapsEmbedUrl({
      apiKey: 'chave de teste',
      latitude: -23.55052,
      longitude: -46.633308,
    })
    const url = new URL(result!)

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.google.com/maps/embed/v1/place',
    )
    expect(url.searchParams.get('key')).toBe('chave de teste')
    expect(url.searchParams.get('q')).toBe('-23.55052,-46.633308')
    expect(url.searchParams.get('language')).toBe('pt-BR')
    expect(url.searchParams.get('region')).toBe('br')
  })

  it('cria um link de rota que funciona sem chave de API', () => {
    const url = new URL(getGoogleMapsDirectionsUrl(-23.55052, -46.633308))

    expect(`${url.origin}${url.pathname}`).toBe('https://www.google.com/maps/dir/')
    expect(url.searchParams.get('api')).toBe('1')
    expect(url.searchParams.get('destination')).toBe('-23.55052,-46.633308')
  })
})
