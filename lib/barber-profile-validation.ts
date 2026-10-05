import {
  getPasswordError,
  MAX_PASSWORD_LENGTH,
  normalizePhone,
} from '@/lib/validation'

export type BarberProfileField =
  | 'name'
  | 'phone'
  | 'specialty'
  | 'bio'
  | 'currentPassword'
  | 'newPassword'
  | 'passwordConfirmation'

export type BarberProfileErrors = Partial<Record<BarberProfileField, string>>

export interface BarberProfileFormValues {
  name: string
  phone: string
  specialty: string
  bio: string
  currentPassword: string
  newPassword: string
  passwordConfirmation: string
}

export function validateBarberProfileForm(values: BarberProfileFormValues) {
  const name = values.name.trim().replace(/\s+/g, ' ')
  const phoneDigits = values.phone.replace(/\D/g, '')
  const phone = normalizePhone(values.phone)
  const specialty = values.specialty.trim().replace(/\s+/g, ' ')
  const bio = values.bio.trim().replace(/\s+/g, ' ')
  const currentPassword = values.currentPassword
  const newPassword = values.newPassword
  const passwordConfirmation = values.passwordConfirmation
  const errors: BarberProfileErrors = {}

  if (name.length < 3 || name.length > 80) {
    errors.name = 'O nome de exibição deve ter entre 3 e 80 caracteres.'
  }
  if (phoneDigits.length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
    errors.phone = 'Informe um telefone com DDD ou deixe o campo em branco.'
  }
  if (specialty.length < 3 || specialty.length > 160) {
    errors.specialty = 'A especialidade deve ter entre 3 e 160 caracteres.'
  }
  if (bio.length < 3 || bio.length > 500) {
    errors.bio = 'A apresentação deve ter entre 3 e 500 caracteres.'
  }
  if (currentPassword.length > MAX_PASSWORD_LENGTH) {
    errors.currentPassword = 'A senha atual informada é inválida.'
  }

  const isChangingPassword = Boolean(newPassword || passwordConfirmation)
  if (isChangingPassword) {
    const passwordError = getPasswordError(newPassword)
    if (passwordError) errors.newPassword = passwordError
    if (!currentPassword) {
      errors.currentPassword = 'Informe sua senha atual para definir uma nova senha.'
    }
    if (!passwordConfirmation) {
      errors.passwordConfirmation = 'Repita a nova senha.'
    } else if (newPassword !== passwordConfirmation) {
      errors.passwordConfirmation = 'A confirmação não corresponde à nova senha.'
    }
  }

  return {
    data: {
      name,
      phone,
      specialty,
      bio,
      currentPassword,
      newPassword,
      passwordConfirmation,
    },
    errors,
    isChangingPassword,
  }
}
