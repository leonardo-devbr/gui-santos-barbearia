import { NextResponse } from 'next/server'
import type { ResultSetHeader } from 'mysql2/promise'
import { errorResponse, internalErrorResponse, readJsonObject } from '@/lib/api'
import { getAuthenticatedCustomer } from '@/lib/auth'
import { getTodayInSaoPaulo, isValidIsoDate } from '@/lib/date'
import { getPool } from '@/lib/db'
import { isValidEmail, normalizeEmail, normalizePhone } from '@/lib/validation'

type ProfileField =
  | 'name'
  | 'phone'
  | 'email'
  | 'birthDate'
  | 'preferredCut'
  | 'beardStyle'
  | 'notes'

function validateProfile(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const rawPhone = typeof body.phone === 'string' ? body.phone : ''
  const phoneDigits = rawPhone.replace(/\D/g, '')
  const phone = normalizePhone(rawPhone)
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const birthDate = typeof body.birthDate === 'string' ? body.birthDate.trim() : ''
  const preferredCut = typeof body.preferredCut === 'string' ? body.preferredCut.trim() : ''
  const beardStyle = typeof body.beardStyle === 'string' ? body.beardStyle.trim() : ''
  const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
  const errors: Partial<Record<ProfileField, string>> = {}

  if (name.length < 3) errors.name = 'Informe seu nome completo.'
  else if (name.length > 80) errors.name = 'O nome deve ter no máximo 80 caracteres.'

  if (phoneDigits.length < 10 || phoneDigits.length > 11) {
    errors.phone = 'Informe um telefone com DDD.'
  }
  if (!isValidEmail(email) || email.length > 254) errors.email = 'Informe um e-mail válido.'

  if (birthDate && (!isValidIsoDate(birthDate) || birthDate > getTodayInSaoPaulo())) {
    errors.birthDate = 'Informe uma data de nascimento válida.'
  }

  if (preferredCut.length > 100) errors.preferredCut = 'Use no máximo 100 caracteres.'
  if (beardStyle.length > 100) errors.beardStyle = 'Use no máximo 100 caracteres.'
  if (notes.length > 500) errors.notes = 'Use no máximo 500 caracteres.'

  return {
    data: { name, phone, email, birthDate, preferredCut, beardStyle, notes },
    errors,
  }
}

export async function GET() {
  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para continuar.', 401)
    return NextResponse.json({ customer })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const body = await readJsonObject(request)
  if (!body) return errorResponse('Envie os dados do perfil em JSON.', 400)

  const { data, errors } = validateProfile(body)
  if (Object.keys(errors).length > 0) {
    return errorResponse('Revise os campos destacados para continuar.', 422, errors)
  }

  try {
    const customer = await getAuthenticatedCustomer()
    if (!customer) return errorResponse('Faça login para continuar.', 401)

    await getPool().execute<ResultSetHeader>(
      `UPDATE customers
       SET name = ?, phone = ?, email = ?, birth_date = ?, preferred_cut = ?, beard_style = ?, notes = ?
       WHERE id = ?`,
      [
        data.name,
        data.phone,
        data.email,
        data.birthDate || null,
        data.preferredCut,
        data.beardStyle,
        data.notes,
        customer.id,
      ],
    )

    return NextResponse.json({ message: 'Perfil atualizado com sucesso.' })
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return errorResponse('Já existe uma conta com este e-mail.', 409, {
        email: 'Este e-mail já está sendo usado por outra conta.',
      })
    }

    return internalErrorResponse(error)
  }
}

function isDuplicateEntry(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY')
}
