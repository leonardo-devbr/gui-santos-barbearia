export const MAX_PASSWORD_LENGTH = 128

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string) {
  return emailPattern.test(normalizeEmail(value))
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value)

  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function getPasswordError(password: string) {
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`
  }

  if (password.length < 8 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return 'Use ao menos 8 caracteres, incluindo uma letra e um número.'
  }

  return null
}
