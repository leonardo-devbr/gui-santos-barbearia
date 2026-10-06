export const MAX_PASSWORD_LENGTH = 128
export const MIN_PASSWORD_LENGTH = 12

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const brazilianAreaCodes = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
])

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string) {
  return emailPattern.test(normalizeEmail(value))
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function isValidBrazilianPhone(value: string) {
  const phone = value.replace(/\D/g, '')
  if (phone.length !== 10 && phone.length !== 11) return false
  if (!brazilianAreaCodes.has(phone.slice(0, 2))) return false

  const subscriberNumber = phone.slice(2)
  if (phone.length === 11) return /^9\d{8}$/.test(subscriberNumber)
  if (phone.length === 10) return /^[2-5]\d{7}$/.test(subscriberNumber)
  return false
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

  if (
    password.length < MIN_PASSWORD_LENGTH ||
    !/[A-Za-zÀ-ÿ]/.test(password) ||
    !/\d/.test(password)
  ) {
    return `Use ao menos ${MIN_PASSWORD_LENGTH} caracteres, incluindo uma letra e um número.`
  }

  return null
}
