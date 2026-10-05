import 'server-only'

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import {
  getAuthenticatedStaff,
  getCurrentStaffSessionTokenHash,
  type StaffUser,
} from '@/lib/admin-auth'
import {
  type BarberProfileField,
  validateBarberProfileForm,
} from '@/lib/barber-profile-validation'
import { getBarberPhotoUrl } from '@/lib/barber-photo'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { getPool, withTransaction } from '@/lib/db'
import type { BarberProfile } from '@/lib/types'

interface BarberProfileRow extends RowDataPacket {
  id: string
  name: string
  email: string
  phone: string
  specialty: string
  bio: string
  photo_url: string
  has_uploaded_photo: number | boolean
  photo_position_x: number
  photo_position_y: number
  photo_revision: number
}

interface LockedBarberProfileRow extends BarberProfileRow {
  password_hash: string
}

interface IdRow extends RowDataPacket {
  id: string
}

export class BarberProfileError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: BarberProfileField,
  ) {
    super(message)
  }
}

function mapProfile(row: BarberProfileRow): BarberProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    specialty: row.specialty,
    bio: row.bio,
    photoUrl: getBarberPhotoUrl(
      row.id,
      row.photo_url,
      Boolean(row.has_uploaded_photo),
      row.photo_revision,
    ),
    photoPositionX: row.photo_position_x,
    photoPositionY: row.photo_position_y,
  }
}

function requireBarberIdentity(staff: StaffUser | null) {
  if (!staff) throw new BarberProfileError('Faça login para continuar.', 401)
  if (staff.role !== 'barber' || !staff.barberId) {
    throw new BarberProfileError('Este perfil está disponível apenas para barbeiros.', 403)
  }
  return staff as StaffUser & { role: 'barber'; barberId: string }
}

export async function getBarberProfile(staff: StaffUser) {
  const barber = requireBarberIdentity(staff)
  const [rows] = await getPool().execute<BarberProfileRow[]>(
    `SELECT
       barbers.id,
       barbers.name,
       staff_users.email,
       barbers.phone,
       barbers.specialty,
       barbers.bio,
       barbers.photo_url,
       barbers.photo_data IS NOT NULL AS has_uploaded_photo,
       barbers.photo_position_x,
       barbers.photo_position_y,
       barbers.photo_revision
     FROM staff_users
     INNER JOIN barbers ON barbers.id = staff_users.barber_id
     WHERE staff_users.id = ?
       AND staff_users.barber_id = ?
       AND staff_users.role = 'barber'
       AND staff_users.is_active = TRUE
       AND barbers.is_active = TRUE
     LIMIT 1`,
    [barber.id, barber.barberId],
  )
  if (!rows[0]) throw new BarberProfileError('Perfil profissional não encontrado.', 404)
  return mapProfile(rows[0])
}

export async function getCurrentBarberProfile() {
  return getBarberProfile(requireBarberIdentity(await getAuthenticatedStaff()))
}

export async function updateCurrentBarberProfile(body: Record<string, unknown>) {
  const staff = requireBarberIdentity(await getAuthenticatedStaff())
  const sessionTokenHash = await getCurrentStaffSessionTokenHash()
  if (!sessionTokenHash) throw new BarberProfileError('Sua sessão expirou. Entre novamente.', 401)

  const { data, errors, isChangingPassword } = validateBarberProfileForm({
    name: typeof body.name === 'string' ? body.name : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    specialty: typeof body.specialty === 'string' ? body.specialty : '',
    bio: typeof body.bio === 'string' ? body.bio : '',
    currentPassword: typeof body.currentPassword === 'string' ? body.currentPassword : '',
    newPassword: typeof body.newPassword === 'string' ? body.newPassword : '',
    passwordConfirmation:
      typeof body.passwordConfirmation === 'string' ? body.passwordConfirmation : '',
  })
  const firstError = Object.entries(errors)[0] as [BarberProfileField, string] | undefined
  if (firstError) {
    throw new BarberProfileError(firstError[1], 422, firstError[0])
  }

  return withTransaction(async (connection) => {
    const [rows] = await connection.execute<LockedBarberProfileRow[]>(
      `SELECT
         barbers.id,
         barbers.name,
         staff_users.email,
         staff_users.password_hash,
         barbers.phone,
         barbers.specialty,
         barbers.bio,
         barbers.photo_url,
         barbers.photo_data IS NOT NULL AS has_uploaded_photo,
         barbers.photo_position_x,
         barbers.photo_position_y,
         barbers.photo_revision
       FROM staff_sessions
       INNER JOIN staff_users ON staff_users.id = staff_sessions.staff_user_id
       INNER JOIN barbers ON barbers.id = staff_users.barber_id
       WHERE staff_sessions.token_hash = ?
         AND staff_sessions.expires_at > UTC_TIMESTAMP()
         AND staff_users.id = ?
         AND staff_users.barber_id = ?
         AND staff_users.role = 'barber'
         AND staff_users.is_active = TRUE
         AND barbers.is_active = TRUE
       LIMIT 1
       FOR UPDATE`,
      [sessionTokenHash, staff.id, staff.barberId],
    )
    const current = rows[0]
    if (!current) throw new BarberProfileError('Sua sessão expirou. Entre novamente.', 401)

    const [duplicates] = await connection.execute<IdRow[]>(
      'SELECT id FROM barbers WHERE name = ? AND id <> ? LIMIT 1 FOR UPDATE',
      [data.name, staff.barberId],
    )
    if (duplicates[0]) {
      throw new BarberProfileError('Já existe um barbeiro com este nome.', 409, 'name')
    }

    let passwordHash: string | null = null
    if (isChangingPassword) {
      if (!(await verifyPassword(data.currentPassword, current.password_hash))) {
        throw new BarberProfileError('A senha atual não confere.', 422, 'currentPassword')
      }
      passwordHash = await hashPassword(data.newPassword)
    }

    await connection.execute<ResultSetHeader>(
      `UPDATE barbers
       SET name = ?, phone = ?, specialty = ?, bio = ?
       WHERE id = ?`,
      [data.name, data.phone, data.specialty, data.bio, staff.barberId],
    )

    if (passwordHash) {
      await connection.execute<ResultSetHeader>(
        'UPDATE staff_users SET name = ?, password_hash = ? WHERE id = ?',
        [data.name, passwordHash, staff.id],
      )
      await connection.execute<ResultSetHeader>(
        'DELETE FROM staff_sessions WHERE staff_user_id = ? AND token_hash <> ?',
        [staff.id, sessionTokenHash],
      )
    } else {
      await connection.execute<ResultSetHeader>('UPDATE staff_users SET name = ? WHERE id = ?', [
        data.name,
        staff.id,
      ])
    }

    return {
      profile: mapProfile({
        ...current,
        name: data.name,
        phone: data.phone,
        specialty: data.specialty,
        bio: data.bio,
      }),
      passwordChanged: Boolean(passwordHash),
    }
  })
}
