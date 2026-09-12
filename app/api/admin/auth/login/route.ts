import { NextResponse } from 'next/server'
import type { RowDataPacket } from 'mysql2/promise'
import { createStaffSession } from '@/lib/admin-auth'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { verifyPassword } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { isValidEmail, MAX_PASSWORD_LENGTH, normalizeEmail } from '@/lib/validation'

interface StaffLoginRow extends RowDataPacket {
  id: string
  password_hash: string
  role: 'admin' | 'barber'
}

const dummyPasswordHash =
  'scrypt$6f9c8f460f4ef207d0f9247cd41b278a$0fc89881f74eb107e9ec634f863fe5e385e8ab4a9a7122b75eb0edd877acdeac17245f5ea57b8d7f9bc5b31e645d79f86ea4f1e599a6163f4e5953343b0a1be3'

export async function POST(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie suas credenciais em JSON.', 400)

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!isValidEmail(email) || !password || password.length > MAX_PASSWORD_LENGTH) {
    return errorResponse('Informe um e-mail e uma senha válidos.', 422)
  }

  try {
    const [rows] = await getPool().execute<StaffLoginRow[]>(
      `SELECT id, password_hash, role
       FROM staff_users
       WHERE email = ? AND is_active = TRUE
       LIMIT 1`,
      [email],
    )
    const staff = rows[0]
    const passwordMatches = await verifyPassword(password, staff?.password_hash ?? dummyPasswordHash)

    if (!staff || staff.role !== 'admin' || !passwordMatches) {
      return errorResponse('E-mail ou senha incorretos.', 401)
    }

    await createStaffSession(staff.id)
    return NextResponse.json({ message: 'Acesso administrativo autorizado.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
