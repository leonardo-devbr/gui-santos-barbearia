import { describe, expect, it } from 'vitest'
import { detectBarberPhotoMime, getBarberPhotoUrl } from '@/lib/barber-photo'

describe('fotos dos barbeiros', () => {
  it('reconhece somente formatos de imagem permitidos pela assinatura do arquivo', () => {
    expect(detectBarberPhotoMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
    expect(
      detectBarberPhotoMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe('image/png')
    expect(detectBarberPhotoMime(new TextEncoder().encode('RIFF0000WEBP'))).toBe('image/webp')
    expect(detectBarberPhotoMime(new TextEncoder().encode('<svg></svg>'))).toBeNull()
  })

  it('usa a rota versionada quando existe uma foto importada', () => {
    expect(getBarberPhotoUrl('gui santos', '/foto.jpg', true, 7)).toBe(
      '/api/barbers/gui%20santos/photo?v=7',
    )
    expect(getBarberPhotoUrl('gui', '/foto.jpg', false, 0)).toBe('/foto.jpg')
  })
})
