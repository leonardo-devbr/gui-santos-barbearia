import { describe, expect, it } from 'vitest'
import {
  getApiMessage,
  validateAdminBusinessForm,
  validateAdminBusinessHours,
  validateAdminLoginForm,
  validateAdminScheduleBlockForm,
} from '@/lib/admin-settings-form-validation'

describe('validação dos dados da barbearia', () => {
  it('normaliza dados válidos antes de enviá-los para a API', () => {
    const result = validateAdminBusinessForm({
      name: '  Barbearia   Central  ',
      street: '  Rua   das Flores, 123 ',
      district: '  Centro ',
      city: '  Sorocaba ',
      state: ' sp ',
      postalCode: '18.050-000',
      phone: '(15) 99999-1234',
      email: ' CONTATO@EXAMPLE.COM ',
      cnpj: '12.345.678/0001-90',
      latitude: ' -23.5012345 ',
      longitude: ' -47.4587654 ',
      parkingInfo: '  Estacione   ao lado. ',
      transitInfo: '  Ponto   em frente. ',
    })

    expect(result.errors).toEqual({})
    expect(result.data).toEqual({
      name: 'Barbearia Central',
      street: 'Rua das Flores, 123',
      district: 'Centro',
      city: 'Sorocaba',
      state: 'SP',
      postalCode: '18050000',
      phone: '15999991234',
      email: 'contato@example.com',
      cnpj: '12345678000190',
      latitude: -23.5012345,
      longitude: -47.4587654,
      parkingInfo: 'Estacione ao lado.',
      transitInfo: 'Ponto em frente.',
    })
  })

  it('informa erros para todos os campos inválidos', () => {
    const result = validateAdminBusinessForm({
      name: 'A',
      street: 'R',
      district: 'C',
      city: 'S',
      state: 'São Paulo',
      postalCode: '123',
      phone: '1599',
      email: 'email-invalido',
      cnpj: '123',
      latitude: '91',
      longitude: '-181',
      parkingInfo: 'a'.repeat(256),
      transitInfo: 'b'.repeat(256),
    })

    expect(result.errors).toEqual({
      name: 'O nome deve ter entre 2 e 100 caracteres.',
      street: 'Informe um endereço válido.',
      district: 'Informe um bairro válido.',
      city: 'Informe uma cidade válida.',
      state: 'Informe a sigla do estado com duas letras.',
      postalCode: 'Informe um CEP com 8 dígitos.',
      phone: 'Informe um telefone com DDD.',
      email: 'Informe um e-mail válido.',
      cnpj: 'Informe um CNPJ com 14 dígitos ou deixe o campo vazio.',
      latitude: 'Informe uma latitude válida.',
      longitude: 'Informe uma longitude válida.',
      parkingInfo: 'A orientação de estacionamento deve ter no máximo 255 caracteres.',
      transitInfo: 'A orientação de transporte deve ter no máximo 255 caracteres.',
    })
  })

  it('rejeita telefone com código do país sem truncar os dígitos', () => {
    const result = validateAdminBusinessForm({
      name: 'Barbearia Central',
      street: 'Rua das Flores, 123',
      district: 'Centro',
      city: 'Sorocaba',
      state: 'SP',
      postalCode: '18050000',
      phone: '+55 (15) 99999-1234',
      email: 'contato@example.com',
      cnpj: '',
      latitude: '-23.5012345',
      longitude: '-47.4587654',
      parkingInfo: '',
      transitInfo: '',
    })

    expect(result.errors.phone).toBe('Informe um telefone com DDD.')
    expect(result.data.phone).toBe('5515999991234')
  })
})

describe('validação dos horários comerciais', () => {
  it('aceita dias fechados e horários abertos em intervalos de 30 minutos', () => {
    expect(
      validateAdminBusinessHours([
        { weekday: 0, isOpen: false, openTime: null, closeTime: null },
        { weekday: 1, isOpen: true, openTime: '09:00', closeTime: '18:30' },
      ]),
    ).toBeNull()
  })

  it('rejeita fechamento anterior ou igual à abertura', () => {
    expect(
      validateAdminBusinessHours([
        { weekday: 2, isOpen: true, openTime: '18:00', closeTime: '18:00' },
      ]),
    ).toEqual({
      weekday: 2,
      message: 'O horário de fechamento deve ser posterior ao de abertura.',
    })
  })

  it('rejeita horários fora dos intervalos de 30 minutos', () => {
    expect(
      validateAdminBusinessHours([
        { weekday: 3, isOpen: true, openTime: '09:15', closeTime: '18:00' },
      ]),
    ).toEqual({
      weekday: 3,
      message: 'Use horários em intervalos de 30 minutos.',
    })
  })
})

describe('validação dos bloqueios de agenda', () => {
  it('normaliza um bloqueio de dia inteiro e descarta os horários', () => {
    const result = validateAdminScheduleBlockForm({
      barberId: ' all ',
      date: '2026-10-10',
      fullDay: true,
      startTime: 'valor ignorado',
      endTime: 'valor ignorado',
      reason: '  Feriado   municipal ',
      today: '2026-10-10',
    })

    expect(result.errors).toEqual({})
    expect(result.data).toEqual({
      barberId: 'all',
      date: '2026-10-10',
      fullDay: true,
      startTime: null,
      endTime: null,
      reason: 'Feriado municipal',
    })
  })

  it('aceita um bloqueio parcial com início anterior ao término', () => {
    const result = validateAdminScheduleBlockForm({
      barberId: 'barber-1',
      date: '2026-10-11',
      fullDay: false,
      startTime: '14:00',
      endTime: '15:30',
      reason: ' Compromisso pessoal ',
      today: '2026-10-10',
    })

    expect(result.errors).toEqual({})
    expect(result.data).toMatchObject({
      startTime: '14:00',
      endTime: '15:30',
      reason: 'Compromisso pessoal',
    })
  })

  it('rejeita data passada, período invertido e motivo inválido', () => {
    const result = validateAdminScheduleBlockForm({
      barberId: '',
      date: '2026-10-09',
      fullDay: false,
      startTime: '16:00',
      endTime: '15:00',
      reason: 'x',
      today: '2026-10-10',
    })

    expect(result.errors).toEqual({
      barberId: 'Selecione um barbeiro válido.',
      date: 'Escolha uma data atual ou futura.',
      endTime: 'O horário de término deve ser posterior ao horário de início.',
      reason: 'O motivo deve ter entre 3 e 160 caracteres.',
    })
  })

  it('exige ambos os horários em um bloqueio parcial', () => {
    const result = validateAdminScheduleBlockForm({
      barberId: 'all',
      date: '2026-10-10',
      fullDay: false,
      startTime: '',
      endTime: '',
      reason: 'Manutenção',
      today: '2026-10-10',
    })

    expect(result.errors).toMatchObject({
      startTime: 'Selecione o horário de início.',
      endTime: 'Selecione o horário de término.',
    })
  })
})

describe('validação do login administrativo', () => {
  it('normaliza o e-mail e preserva a senha válida', () => {
    const result = validateAdminLoginForm({
      email: ' ADMIN@EXAMPLE.COM ',
      password: 'SenhaAdministrativa123!',
    })

    expect(result).toEqual({
      data: {
        email: 'admin@example.com',
        password: 'SenhaAdministrativa123!',
      },
      errors: {},
    })
  })

  it('rejeita e-mail inválido, senha ausente e senha acima do limite', () => {
    expect(
      validateAdminLoginForm({ email: 'inválido', password: '' }).errors,
    ).toEqual({
      email: 'Informe um e-mail válido.',
      password: 'Informe sua senha.',
    })

    expect(
      validateAdminLoginForm({
        email: 'admin@example.com',
        password: 'a'.repeat(129),
      }).errors.password,
    ).toBe('A senha deve ter no máximo 128 caracteres.')
  })
})

describe('mensagens retornadas pela API', () => {
  it('normaliza uma mensagem válida e remove caracteres de controle', () => {
    expect(getApiMessage({ message: '  Falha\u0000 temporária.  ' }, 'Mensagem padrão.')).toBe(
      'Falha temporária.',
    )
  })

  it('usa a mensagem padrão para respostas ausentes, inválidas ou excessivas', () => {
    const fallback = 'Não foi possível concluir.'

    expect(getApiMessage(null, fallback)).toBe(fallback)
    expect(getApiMessage({ message: 123 }, fallback)).toBe(fallback)
    expect(getApiMessage({ message: '   ' }, fallback)).toBe(fallback)
    expect(getApiMessage({ message: 'a'.repeat(601) }, fallback)).toBe(fallback)
  })
})
