import { describe, expect, it } from 'vitest'
import {
  formatPhone,
  getPasswordError,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
} from '@/lib/validation'

describe('validação de cadastro', () => {
  it('normaliza e valida endereços de e-mail', () => {
    expect(normalizeEmail('  USER@Example.COM  ')).toBe('user@example.com')
    expect(isValidEmail(' User.Name+tag@Example.com ')).toBe(true)

    for (const invalidEmail of ['', 'sem-arroba.com', 'a@b', 'a @b.com', 'a@ b.com']) {
      expect(isValidEmail(invalidEmail)).toBe(false)
    }
  })

  it('normaliza telefones e limita o resultado a onze dígitos', () => {
    expect(normalizePhone('(11) 9 8765-4321 ramal 9')).toBe('11987654321')
    expect(normalizePhone('sem telefone')).toBe('')
  })

  it.each([
    ['', ''],
    ['1', '(1'],
    ['119876', '(11) 9876'],
    ['1198765', '(11) 9876-5'],
    ['1133334444', '(11) 3333-4444'],
    ['11987654321', '(11) 98765-4321'],
  ])('formata o telefone %s', (value, expected) => {
    expect(formatPhone(value)).toBe(expected)
  })

  it('aplica os requisitos e limites de senha', () => {
    const minimumMessage = 'Use ao menos 12 caracteres, incluindo uma letra e um número.'

    expect(getPasswordError('abcdefghij1')).toBe(minimumMessage)
    expect(getPasswordError('abcdefghijkl')).toBe(minimumMessage)
    expect(getPasswordError('123456789012')).toBe(minimumMessage)
    expect(getPasswordError('ábcdefghijk1')).toBeNull()
    expect(getPasswordError(`${'a'.repeat(127)}1`)).toBeNull()
    expect(getPasswordError(`${'a'.repeat(128)}1`)).toBe(
      'A senha deve ter no máximo 128 caracteres.',
    )
  })
})
