export const MAX_BARBER_PHOTO_BYTES = 5 * 1024 * 1024

export function getBarberPhotoUrl(
  id: string,
  fallbackUrl: string,
  hasUploadedPhoto: boolean,
  revision: number,
) {
  if (!hasUploadedPhoto) return fallbackUrl
  return `/api/barbers/${encodeURIComponent(id)}/photo?v=${revision}`
}

export function detectBarberPhotoMime(bytes: Uint8Array) {
  const isJpeg =
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (isJpeg) return 'image/jpeg'

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  const isPng =
    bytes.length >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value)
  if (isPng) return 'image/png'

  const isWebp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  if (isWebp) return 'image/webp'

  return null
}
