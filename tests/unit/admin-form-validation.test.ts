import { describe, expect, it } from 'vitest'
import {
  formatBRLCurrencyInput,
  formatBRLCurrencyValue,
  parseBRLCurrencyInput,
  validateAdminServiceForm,
  validateAdminUserForm,
} from '@/lib/admin-form-validation'

describe('máscara monetária administrativa', () => {
  it.each([
    ['1', 'R$ 0,01'],
    ['1234', 'R$ 12,34'],
    ['R$ 1.234,56', 'R$ 1.234,56'],
    ['texto', ''],
  ])('formata %s em reais', (input, expected) => {
    expect(formatBRLCurrencyInput(input)).toBe(expected)
  })

  it('formata um valor existente e converte a máscara para a API', () => {
    expect(formatBRLCurrencyValue(49.9)).toBe('R$ 49,90')
    expect(parseBRLCurrencyInput('R$ 49,90')).toBe(49.9)
    expect(parseBRLCurrencyInput('')).toBeNull()
  })
})

describe('validação dos formulários administrativos', () => {
  it('normaliza um serviço válido', () => {
    const result = validateAdminServiceForm({
      name: '  Corte   tradicional ',
      description: ' Corte feito na tesoura. ',
      durationMinutes: '45',
      price: 'R$ 59,90',
      category: 'cortes',
    })

    expect(result.errors).toEqual({})
    expect(result.data).toEqual({
      name: 'Corte tradicional',
      description: 'Corte feito na tesoura.',
      durationMinutes: 45,
      price: 59.9,
      category: 'cortes',
    })
  })

  it('identifica cada campo inválido do serviço', () => {
    const result = validateAdminServiceForm({
      name: '',
      description: '',
      durationMinutes: '7.5',
      price: 'R$ 0,00',
      category: 'inexistente',
    })

    expect(Object.keys(result.errors)).toEqual([
      'name',
      'description',
      'durationMinutes',
      'price',
      'category',
    ])
  })

  it('valida os campos obrigatórios de um novo acesso', () => {
    const result = validateAdminUserForm(
      {
        role: 'barber',
        barberId: '',
        name: 'A',
        email: 'email-invalido',
        password: 'curta',
        passwordConfirmation: 'diferente',
        currentPassword: '',
        notificationPhone: '',
        whatsappOptIn: true,
      },
      false,
    )

    expect(result.errors).toMatchObject({
      barberId: 'Selecione o perfil do barbeiro.',
      name: 'O nome deve ter entre 3 e 80 caracteres.',
      email: 'Informe um e-mail válido.',
      password: 'Use ao menos 12 caracteres, incluindo uma letra e um número.',
      passwordConfirmation: 'A confirmação não corresponde à senha informada.',
      currentPassword: 'Informe sua senha atual para confirmar esta operação.',
      notificationPhone: 'Informe um telefone brasileiro válido para ativar os avisos.',
    })
  })

  it('permite manter a senha ao editar um acesso', () => {
    const result = validateAdminUserForm(
      {
        role: 'admin',
        barberId: '',
        name: 'Administrador',
        email: 'ADMIN@EXAMPLE.COM',
        password: '',
        passwordConfirmation: '',
        currentPassword: 'senha-atual',
        notificationPhone: '',
        whatsappOptIn: false,
      },
      true,
    )

    expect(result.errors).toEqual({})
    expect(result.data.email).toBe('admin@example.com')
    expect(result.data.barberId).toBeNull()
  })

  it('normaliza o telefone e exige um número brasileiro ao ativar o WhatsApp', () => {
    const valid = validateAdminUserForm(
      {
        role: 'admin',
        barberId: '',
        name: 'Administrador',
        email: 'admin@example.com',
        password: '',
        passwordConfirmation: '',
        currentPassword: 'senha-atual',
        notificationPhone: '(15) 99999-1234',
        whatsappOptIn: true,
      },
      true,
    )

    expect(valid.errors).toEqual({})
    expect(valid.data).toMatchObject({
      notificationPhone: '15999991234',
      whatsappOptIn: true,
    })

    const invalid = validateAdminUserForm(
      {
        role: 'admin',
        barberId: '',
        name: 'Administrador',
        email: 'admin@example.com',
        password: '',
        passwordConfirmation: '',
        currentPassword: 'senha-atual',
        notificationPhone: '',
        whatsappOptIn: true,
      },
      true,
    )
    expect(invalid.errors.notificationPhone).toContain('telefone brasileiro válido')
  })
})
