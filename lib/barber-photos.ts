import 'server-only'

import { createHash } from 'node:crypto'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getAuthenticatedStaff } from '@/lib/admin-auth'
import { detectBarberPhotoMime, MAX_BARBER_PHOTO_BYTES } from '@/lib/barber-photo'
import { getPool } from '@/lib/db'

interface BarberPhotoRow extends RowDataPacket {
  photo_data: Buffer
  photo_mime: string
}

interface BarberPhotoRevisionRow extends RowDataPacket {
  photo_revision: number
}

export class BarberPhotoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

function validateBarberId(id: string) {
  if (!id || id.length > 64) throw new BarberPhotoError('Barbeiro não encontrado.', 404)
}

export async function getBarberPhoto(id: string) {
  validateBarberId(id)
  const [rows] = await getPool().execute<BarberPhotoRow[]>(
    `SELECT photo_data, photo_mime
     FROM barbers
     WHERE id = ? AND photo_data IS NOT NULL AND photo_mime IS NOT NULL
     LIMIT 1`,
    [id],
  )
  const photo = rows[0]
  if (!photo) throw new BarberPhotoError('Foto não encontrada.', 404)

  const bytes = new Uint8Array(photo.photo_data)
  return {
    bytes,
    mime: photo.photo_mime,
    etag: `"${createHash('sha256').update(bytes).digest('base64url')}"`,
  }
}

export async function saveAdminBarberPhoto(id: string, bytes: Uint8Array) {
  const staff = await getAuthenticatedStaff()
  if (!staff) throw new BarberPhotoError('Acesso administrativo não autorizado.', 401)
  if (staff.role !== 'admin') {
    throw new BarberPhotoError('Você não tem permissão para alterar fotos da equipe.', 403)
  }
  validateBarberId(id)

  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BARBER_PHOTO_BYTES) {
    throw new BarberPhotoError('Escolha uma imagem de até 5 MB.', 422)
  }
  const mime = detectBarberPhotoMime(bytes)
  if (!mime) {
    throw new BarberPhotoError('Use uma imagem JPEG, PNG ou WebP válida.', 422)
  }

  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE barbers
     SET photo_data = ?, photo_mime = ?, photo_revision = photo_revision + 1
     WHERE id = ?`,
    [Buffer.from(bytes), mime, id],
  )
  if (result.affectedRows === 0) throw new BarberPhotoError('Barbeiro não encontrado.', 404)

  const [rows] = await getPool().execute<BarberPhotoRevisionRow[]>(
    'SELECT photo_revision FROM barbers WHERE id = ? LIMIT 1',
    [id],
  )
  return {
    photoUrl: `/api/barbers/${encodeURIComponent(id)}/photo?v=${rows[0].photo_revision}`,
  }
}
