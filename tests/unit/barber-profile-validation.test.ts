import { describe, expect, it } from 'vitest'
import { validateAdminBarberForm } from '@/lib/admin-barber-validation'
import { validateBarberProfileForm } from '@/lib/barber-profile-validation'

describe('validação do perfil do barbeiro', () => {
  it('normaliza os dados profissionais sem alterar a senha', () => {
    const result = validateBarberProfileForm({
      name: '  João   da Silva ',
      phone: '(15) 99999-1234',
      specialty: '  Corte   clássico ',
      bio: ' Atendimento cuidadoso e personalizado. ',
      currentPassword: '',
      newPassword: '',
      passwordConfirmation: '',
      whatsappOptIn: true,
    })

    expect(result.errors).toEqual({})
    expect(result.isChangingPassword).toBe(false)
    expect(result.data).toMatchObject({
      name: 'João da Silva',
      phone: '15999991234',
      specialty: 'Corte clássico',
      bio: 'Atendimento cuidadoso e personalizado.',
    })
  })

  it('exige a senha atual e a confirmação ao trocar a senha', () => {
    const result = validateBarberProfileForm({
      name: 'João da Silva',
      phone: '',
      specialty: 'Corte clássico',
      bio: 'Atendimento cuidadoso.',
      currentPassword: '',
      newPassword: 'NovaSenha1234',
      passwordConfirmation: 'OutraSenha1234',
      whatsappOptIn: false,
    })

    expect(result.errors).toMatchObject({
      currentPassword: 'Informe sua senha atual para definir uma nova senha.',
      passwordConfirmation: 'A confirmação não corresponde à nova senha.',
    })
  })

  it('rejeita telefone incompleto e senha fraca', () => {
    const result = validateBarberProfileForm({
      name: 'João da Silva',
      phone: '(15) 9999',
      specialty: 'Corte clássico',
      bio: 'Atendimento cuidadoso.',
      currentPassword: 'senha-atual',
      newPassword: 'curta',
      passwordConfirmation: 'curta',
      whatsappOptIn: false,
    })

    expect(result.errors.phone).toBe('Informe um telefone com DDD ou deixe o campo em branco.')
    expect(result.errors.newPassword).toContain('12 caracteres')
  })

  it('exige telefone brasileiro válido quando o barbeiro aceita os avisos', () => {
    const result = validateBarberProfileForm({
      name: 'João da Silva',
      phone: '',
      specialty: 'Corte clássico',
      bio: 'Atendimento cuidadoso.',
      currentPassword: '',
      newPassword: '',
      passwordConfirmation: '',
      whatsappOptIn: true,
    })

    expect(result.errors.phone).toBe(
      'Informe um telefone brasileiro válido para ativar os avisos.',
    )
  })
})

describe('validação administrativa de barbeiros', () => {
  it('retorna erros específicos para cada campo inválido', () => {
    const result = validateAdminBarberForm({
      name: 'A',
      phone: '159',
      specialty: '',
      bio: '',
      rating: '8',
      reviewCount: '-1',
    })

    expect(Object.keys(result.errors)).toEqual([
      'name',
      'phone',
      'specialty',
      'bio',
      'rating',
      'reviewCount',
    ])
  })

  it('não interpreta campos numéricos vazios como zero válido', () => {
    const result = validateAdminBarberForm({
      name: 'João da Silva',
      phone: '',
      specialty: 'Corte clássico',
      bio: 'Atendimento cuidadoso.',
      rating: '',
      reviewCount: '',
    })

    expect(result.errors).toMatchObject({
      rating: 'A avaliação deve estar entre 0 e 5.',
      reviewCount: 'Informe uma quantidade válida de avaliações.',
    })
  })
})
