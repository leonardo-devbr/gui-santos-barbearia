import type { Service, StaffRole } from '@/lib/types'
import { getPasswordError, isValidEmail, MAX_PASSWORD_LENGTH, normalizeEmail } from '@/lib/validation'

const serviceCategories: Service['category'][] = ['cortes', 'barba', 'combos', 'acabamentos']

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export type AdminServiceFormField =
  | 'name'
  | 'description'
  | 'durationMinutes'
  | 'price'
  | 'category'

export type AdminServiceFormErrors = Partial<Record<AdminServiceFormField, string>>

export type AdminUserFormField =
  | 'role'
  | 'barberId'
  | 'name'
  | 'email'
  | 'password'
  | 'passwordConfirmation'
  | 'currentPassword'

export type AdminUserFormErrors = Partial<Record<AdminUserFormField, string>>

export function formatBRLCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''

  const cents = Number(digits)
  if (!Number.isSafeInteger(cents)) return ''

  return currencyFormatter.format(cents / 100)
}

export function formatBRLCurrencyValue(value: number) {
  if (!Number.isFinite(value)) return ''
  return currencyFormatter.format(value)
}

export function parseBRLCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return null

  const cents = Number(digits)
  if (!Number.isSafeInteger(cents)) return null

  return cents / 100
}

export function validateAdminServiceForm(input: {
  name: string
  description: string
  durationMinutes: string
  price: string
  category: string
}) {
  const errors: AdminServiceFormErrors = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  const description = input.description.trim().replace(/\s+/g, ' ')
  const durationMinutes = Number(input.durationMinutes)
  const price = parseBRLCurrencyInput(input.price)

  if (name.length < 2 || name.length > 100) {
    errors.name = 'O nome deve ter entre 2 e 100 caracteres.'
  }
  if (description.length < 3 || description.length > 255) {
    errors.description = 'A descrição deve ter entre 3 e 255 caracteres.'
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 240) {
    errors.durationMinutes = 'Informe uma duração entre 5 e 240 minutos.'
  }
  if (price === null || price <= 0 || price > 9999.99) {
    errors.price = 'Informe um preço entre R$ 0,01 e R$ 9.999,99.'
  }
  if (!serviceCategories.includes(input.category as Service['category'])) {
    errors.category = 'Selecione uma categoria válida.'
  }

  return {
    data: {
      name,
      description,
      durationMinutes,
      price,
      category: input.category as Service['category'],
    },
    errors,
  }
}

export function validateAdminUserForm(
  input: {
    role: StaffRole
    barberId: string
    name: string
    email: string
    password: string
    passwordConfirmation: string
    currentPassword: string
  },
  editing: boolean,
) {
  const errors: AdminUserFormErrors = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  const email = normalizeEmail(input.email)

  if (input.role !== 'admin' && input.role !== 'barber') {
    errors.role = 'Selecione um tipo de acesso válido.'
  }
  if (input.role === 'barber' && !input.barberId) {
    errors.barberId = 'Selecione o perfil do barbeiro.'
  }
  if (name.length < 3 || name.length > 80) {
    errors.name = 'O nome deve ter entre 3 e 80 caracteres.'
  }
  if (!isValidEmail(email) || email.length > 254) {
    errors.email = 'Informe um e-mail válido.'
  }

  if (!input.password && !editing) {
    errors.password = 'Informe uma senha inicial.'
  } else if (input.password) {
    const passwordError = getPasswordError(input.password)
    if (passwordError) errors.password = passwordError
  }

  if (input.password !== input.passwordConfirmation) {
    errors.passwordConfirmation = 'A confirmação não corresponde à senha informada.'
  }
  if (!input.currentPassword) {
    errors.currentPassword = 'Informe sua senha atual para confirmar esta operação.'
  } else if (input.currentPassword.length > MAX_PASSWORD_LENGTH) {
    errors.currentPassword = `A senha atual deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`
  }

  return {
    data: {
      name,
      email,
      password: input.password,
      role: input.role,
      barberId: input.role === 'barber' ? input.barberId : null,
      currentPassword: input.currentPassword,
    },
    errors,
  }
}
