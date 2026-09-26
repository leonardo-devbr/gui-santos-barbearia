import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mysql, {
  type Connection,
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDaysToIsoDate, getTodayInSaoPaulo } from '@/lib/date'
import type { AppointmentInput } from '@/lib/appointments'

const staffCookies = vi.hoisted(() => new Map<string, string>())

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get(name: string) {
      const value = staffCookies.get(name)
      return value ? { name, value } : undefined
    },
    set(name: string, value: string) {
      staffCookies.set(name, value)
    },
    delete(name: string) {
      staffCookies.delete(name)
    },
  }),
}))

interface AppointmentDatabaseRow extends RowDataPacket {
  id: string
  customer_id: string
  service_id: string
  barber_id: string
  appointment_date: string
  appointment_time: string
  status: string
  price: number
  duration_minutes: number
}

interface CountRow extends RowDataPacket {
  total: number
}

interface BusinessHourDatabaseRow extends RowDataPacket {
  is_open: number | boolean
  open_time: string | null
  close_time: string | null
}

interface BarberActiveRow extends RowDataPacket {
  is_active: number | boolean
}

const TEST_DATABASE_PREFIX = 'gui_santos_barbearia_test_'
const testDatabase = `${TEST_DATABASE_PREFIX}${process.pid}_${randomBytes(4).toString('hex')}`
const testDatabasePattern = /^gui_santos_barbearia_test_\d+_[a-f0-9]{8}$/
const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const staffUserId = '00000000-0000-4000-8000-000000000001'
const environmentKeys = [
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'MYSQL_SSL',
] as const
const originalEnvironment = new Map(
  environmentKeys.map((name) => [name, process.env[name]] as const),
)

let adminConnection: Connection | undefined
let applicationPool: Pool
let databaseCreated = false
let appointmentModule: typeof import('@/lib/appointments')
let databaseModule: typeof import('@/lib/db')
let adminAppointmentModule: typeof import('@/lib/admin-appointments')
let adminScheduleBlockModule: typeof import('@/lib/admin-schedule-blocks')
let adminAuthModule: typeof import('@/lib/admin-auth')
let adminBarberModule: typeof import('@/lib/admin-barbers')
let adminBusinessModule: typeof import('@/lib/admin-business')
let adminServiceModule: typeof import('@/lib/admin-services')
let adminUserModule: typeof import('@/lib/admin-users')
let authModule: typeof import('@/lib/auth')

function restoreEnvironment() {
  for (const name of environmentKeys) {
    const value = originalEnvironment.get(name)
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

function findNextOpenDate() {
  let date = addDaysToIsoDate(getTodayInSaoPaulo(), 1)

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    if (weekday >= 2 && weekday <= 6) return date
    date = addDaysToIsoDate(date, 1)
  }

  throw new Error('Não foi possível encontrar um dia de atendimento para o teste.')
}

function getDefaultBusinessHours() {
  return Array.from({ length: 7 }, (_, weekday) => {
    const isOpen = weekday >= 2
    return {
      weekday,
      isOpen,
      openTime: isOpen ? '09:00' : null,
      closeTime: isOpen ? (weekday === 6 ? '18:00' : '20:00') : null,
    }
  })
}

async function createCustomer(label: string) {
  const id = randomUUID()
  await applicationPool.execute<ResultSetHeader>(
    `INSERT INTO customers
      (id, name, phone, email, email_verified_at, password_hash)
     VALUES (?, ?, '11999999999', ?, UTC_TIMESTAMP(), 'scrypt:test')`,
    [id, `Cliente ${label}`, `${label}-${id}@example.test`],
  )
  return id
}

async function activateStaffSession(staffId: string) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  await applicationPool.execute<ResultSetHeader>(
    `INSERT INTO staff_sessions (token_hash, staff_user_id, expires_at)
     VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))`,
    [tokenHash, staffId],
  )
  staffCookies.set('gui_santos_staff_session', token)
}

async function createBarberStaff(barberId: string) {
  const id = randomUUID()
  await applicationPool.execute<ResultSetHeader>(
    `INSERT INTO staff_users (id, name, email, password_hash, role, barber_id, is_active)
     VALUES (?, ?, ?, 'scrypt:test', 'barber', ?, TRUE)`,
    [id, `Barbeiro ${barberId}`, `${id}@example.test`, barberId],
  )
  await activateStaffSession(id)
  return id
}

function appointmentInput(
  date: string,
  time: string,
  barberId = 'guilherme',
  serviceId = 'corte',
): AppointmentInput {
  return { serviceId, barberId, date, time }
}

function expectSingleConflict(results: PromiseSettledResult<unknown>[]) {
  const successes = results.filter((result) => result.status === 'fulfilled')
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )

  expect(successes).toHaveLength(1)
  expect(failures).toHaveLength(1)
  expect(failures[0].reason).toBeInstanceOf(appointmentModule.AppointmentError)
  expect((failures[0].reason as InstanceType<typeof appointmentModule.AppointmentError>).status).toBe(
    409,
  )
}

beforeAll(async () => {
  if (!testDatabasePattern.test(testDatabase)) {
    throw new Error('O nome do banco temporário não passou pela validação de segurança.')
  }

  const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1'
  if (!localHosts.has(host.toLowerCase())) {
    throw new Error('Os testes de integração só podem criar bancos em uma instância MySQL local.')
  }

  const port = Number(process.env.MYSQL_PORT ?? 3306)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MYSQL_PORT deve ser uma porta válida para executar os testes.')
  }

  const setupUser =
    process.env.MYSQL_SETUP_USER?.trim() || process.env.MYSQL_USER?.trim() || 'root'
  const setupPassword = process.env.MYSQL_SETUP_PASSWORD ?? process.env.MYSQL_PASSWORD ?? ''
  const connectionOptions = {
    host,
    port,
    user: setupUser,
    password: setupPassword,
    charset: 'utf8mb4',
    connectTimeout: 10_000,
  }

  adminConnection = await mysql.createConnection(connectionOptions)
  await adminConnection.query(
    `CREATE DATABASE \`${testDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  )
  databaseCreated = true

  const schemaConnection = await mysql.createConnection({
    ...connectionOptions,
    database: testDatabase,
    multipleStatements: true,
  })

  try {
    const schemaPath = fileURLToPath(new URL('../../database/schema.sql', import.meta.url))
    const schema = await readFile(schemaPath, 'utf8')
    await schemaConnection.query(schema)
  } finally {
    await schemaConnection.end()
  }

  process.env.MYSQL_HOST = host
  process.env.MYSQL_PORT = String(port)
  process.env.MYSQL_USER = setupUser
  process.env.MYSQL_PASSWORD = setupPassword
  process.env.MYSQL_DATABASE = testDatabase
  process.env.MYSQL_SSL = 'false'
  global.mysqlPool = undefined

  databaseModule = await import('@/lib/db')
  appointmentModule = await import('@/lib/appointments')
  adminAppointmentModule = await import('@/lib/admin-appointments')
  adminScheduleBlockModule = await import('@/lib/admin-schedule-blocks')
  adminAuthModule = await import('@/lib/admin-auth')
  adminBarberModule = await import('@/lib/admin-barbers')
  adminBusinessModule = await import('@/lib/admin-business')
  adminServiceModule = await import('@/lib/admin-services')
  adminUserModule = await import('@/lib/admin-users')
  authModule = await import('@/lib/auth')
  applicationPool = databaseModule.getPool()
})

beforeEach(async () => {
  staffCookies.clear()
  for (const table of [
    'email_notifications',
    'schedule_blocks',
    'appointments',
    'sessions',
    'password_reset_tokens',
    'email_verification_tokens',
    'customers',
    'staff_sessions',
    'staff_users',
    'security_rate_limits',
  ]) {
    await applicationPool.query(`DELETE FROM \`${table}\``)
  }

  await applicationPool.execute<ResultSetHeader>(
    `INSERT INTO staff_users (id, name, email, password_hash, role)
     VALUES (?, 'Administrador dos testes', 'admin@example.test', 'scrypt:test', 'admin')`,
    [staffUserId],
  )
  await applicationPool.query('UPDATE barbers SET is_active = TRUE')
  await applicationPool.query(
    `UPDATE business_hours
     SET
       is_open = weekday BETWEEN 2 AND 6,
       open_time = CASE WHEN weekday BETWEEN 2 AND 6 THEN '09:00:00' ELSE NULL END,
       close_time = CASE
         WHEN weekday BETWEEN 2 AND 5 THEN '20:00:00'
         WHEN weekday = 6 THEN '18:00:00'
         ELSE NULL
       END`,
  )
})

afterAll(async () => {
  try {
    if (global.mysqlPool) {
      await global.mysqlPool.end()
      global.mysqlPool = undefined
    }

    if (adminConnection && databaseCreated) {
      if (!testDatabasePattern.test(testDatabase)) {
        throw new Error('A remoção do banco temporário foi bloqueada por segurança.')
      }
      await adminConnection.query(`DROP DATABASE \`${testDatabase}\``)
    }
  } finally {
    await adminConnection?.end()
    restoreEnvironment()
  }
})

describe('agendamentos com MySQL', () => {
  it('cria um agendamento com os dados atuais do serviço', async () => {
    const customerId = await createCustomer('criacao')
    const date = findNextOpenDate()

    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '09:00'),
    )
    const [rows] = await applicationPool.execute<AppointmentDatabaseRow[]>(
      `SELECT id, customer_id, service_id, barber_id, appointment_date, appointment_time,
              status, price, duration_minutes
       FROM appointments WHERE id = ?`,
      [appointmentId],
    )

    expect(rows[0]).toMatchObject({
      id: appointmentId,
      customer_id: customerId,
      service_id: 'corte',
      barber_id: 'guilherme',
      appointment_date: date,
      appointment_time: '09:00:00',
      status: 'confirmado',
      price: 40,
      duration_minutes: 45,
    })
  })

  it('permite somente um vencedor em reservas simultâneas sobrepostas', async () => {
    const firstCustomer = await createCustomer('concorrente-a')
    const secondCustomer = await createCustomer('concorrente-b')
    const date = findNextOpenDate()

    const results = await Promise.allSettled([
      appointmentModule.createAppointment(firstCustomer, appointmentInput(date, '09:00')),
      appointmentModule.createAppointment(secondCustomer, appointmentInput(date, '09:30')),
    ])

    expectSingleConflict(results)
    const [countRows] = await applicationPool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM appointments
       WHERE barber_id = 'guilherme' AND appointment_date = ?
         AND status IN ('confirmado', 'pendente')`,
      [date],
    )
    expect(countRows[0].total).toBe(1)
  })

  it('impede o mesmo cliente de reservar dois barbeiros no mesmo período', async () => {
    const customerId = await createCustomer('dois-barbeiros')
    const date = findNextOpenDate()

    const results = await Promise.allSettled([
      appointmentModule.createAppointment(
        customerId,
        appointmentInput(date, '10:00', 'guilherme'),
      ),
      appointmentModule.createAppointment(customerId, appointmentInput(date, '10:00', 'vitor')),
    ])

    expectSingleConflict(results)
    const [countRows] = await applicationPool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM appointments
       WHERE customer_id = ? AND appointment_date = ?
         AND status IN ('confirmado', 'pendente')`,
      [customerId, date],
    )
    expect(countRows[0].total).toBe(1)
  })

  it('respeita bloqueios administrativos parciais', async () => {
    const customerId = await createCustomer('bloqueio')
    const date = findNextOpenDate()
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO schedule_blocks
        (id, barber_id, block_date, start_time, end_time, reason, created_by)
       VALUES (?, 'guilherme', ?, '09:15:00', '10:15:00', 'Reunião', ?)`,
      [randomUUID(), date, staffUserId],
    )

    await expect(
      appointmentModule.createAppointment(customerId, appointmentInput(date, '09:30')),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('limita cada cliente a cinco agendamentos futuros ativos', async () => {
    const customerId = await createCustomer('limite')
    const date = findNextOpenDate()

    for (const time of ['09:00', '10:00', '11:00', '12:00', '13:00']) {
      await appointmentModule.createAppointment(customerId, appointmentInput(date, time))
    }

    await expect(
      appointmentModule.createAppointment(customerId, appointmentInput(date, '14:00')),
    ).rejects.toMatchObject({
      status: 409,
      message: 'Você pode manter no máximo 5 agendamentos futuros ativos.',
    })
  })

  it('marca como indisponíveis todos os horários que se sobrepõem', async () => {
    const ownerId = await createCustomer('disponibilidade-a')
    const viewerId = await createCustomer('disponibilidade-b')
    const date = findNextOpenDate()
    await appointmentModule.createAppointment(ownerId, appointmentInput(date, '09:00'))

    const slots = await appointmentModule.getAvailability({
      customerId: viewerId,
      serviceId: 'corte',
      barberId: 'guilherme',
      date,
    })

    expect(slots.find((slot) => slot.time === '09:00')?.available).toBe(false)
    expect(slots.find((slot) => slot.time === '09:30')?.available).toBe(false)
    expect(slots.find((slot) => slot.time === '10:00')?.available).toBe(true)
  })

  it('não altera uma remarcação idêntica e protege a propriedade do agendamento', async () => {
    const ownerId = await createCustomer('proprietario')
    const otherCustomerId = await createCustomer('terceiro')
    const date = findNextOpenDate()
    const input = appointmentInput(date, '11:00')
    const appointmentId = await appointmentModule.createAppointment(ownerId, input)

    await expect(
      appointmentModule.rescheduleAppointment(ownerId, appointmentId, input),
    ).resolves.toBe(false)
    await expect(
      appointmentModule.cancelAppointment(otherCustomerId, appointmentId),
    ).rejects.toMatchObject({ status: 404 })
  })

  it('libera o horário depois do cancelamento', async () => {
    const firstCustomer = await createCustomer('cancelamento-a')
    const secondCustomer = await createCustomer('cancelamento-b')
    const date = findNextOpenDate()
    const input = appointmentInput(date, '15:00')
    const firstAppointment = await appointmentModule.createAppointment(firstCustomer, input)

    await appointmentModule.cancelAppointment(firstCustomer, firstAppointment)
    await expect(
      appointmentModule.createAppointment(secondCustomer, input),
    ).resolves.toEqual(expect.any(String))
    await expect(
      appointmentModule.cancelAppointment(firstCustomer, firstAppointment),
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('acesso da equipe com MySQL', () => {
  it('impede bloqueios que atinjam agendamentos ativos e permite períodos adjacentes', async () => {
    const customerId = await createCustomer('conflito-bloqueio')
    const date = findNextOpenDate()
    await appointmentModule.createAppointment(customerId, appointmentInput(date, '09:00'))
    await activateStaffSession(staffUserId)

    await expect(
      adminScheduleBlockModule.createAdminScheduleBlock({
        barberId: 'guilherme',
        date,
        fullDay: false,
        startTime: '09:30',
        endTime: '10:00',
        reason: 'Pausa',
      }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('09:00') })
    await expect(
      adminScheduleBlockModule.createAdminScheduleBlock({
        barberId: 'all',
        date,
        fullDay: true,
        reason: 'Fechamento',
      }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('09:00') })

    await expect(
      adminScheduleBlockModule.createAdminScheduleBlock({
        barberId: 'guilherme',
        date,
        fullDay: false,
        startTime: '08:00',
        endTime: '09:00',
        reason: 'Preparação',
      }),
    ).resolves.toMatchObject({ startTime: '08:00', endTime: '09:00' })
    await expect(
      adminScheduleBlockModule.createAdminScheduleBlock({
        barberId: 'guilherme',
        date,
        fullDay: false,
        startTime: '09:45',
        endTime: '10:00',
        reason: 'Pausa rápida',
      }),
    ).resolves.toMatchObject({ startTime: '09:45', endTime: '10:00' })
  })

  it('impede fechar ou reduzir o expediente sobre agendamentos ativos', async () => {
    const customerId = await createCustomer('conflito-expediente')
    const date = findNextOpenDate()
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    await appointmentModule.createAppointment(customerId, appointmentInput(date, '09:00'))
    await activateStaffSession(staffUserId)

    const closedHours = getDefaultBusinessHours().map((hour) =>
      hour.weekday === weekday
        ? { ...hour, isOpen: false, openTime: null, closeTime: null }
        : hour,
    )
    await expect(
      adminBusinessModule.updateAdminBusinessHours({ hours: closedHours }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('09:00') })

    const reducedHours = getDefaultBusinessHours().map((hour) =>
      hour.weekday === weekday ? { ...hour, closeTime: '09:30' } : hour,
    )
    await expect(
      adminBusinessModule.updateAdminBusinessHours({ hours: reducedHours }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('09:00') })

    const expandedHours = getDefaultBusinessHours().map((hour) =>
      hour.weekday === weekday ? { ...hour, openTime: '08:00' } : hour,
    )
    await expect(
      adminBusinessModule.updateAdminBusinessHours({ hours: expandedHours }),
    ).resolves.toEqual(expandedHours)

    const [rows] = await applicationPool.execute<BusinessHourDatabaseRow[]>(
      'SELECT is_open, open_time, close_time FROM business_hours WHERE weekday = ?',
      [weekday],
    )
    expect(rows[0]).toMatchObject({ is_open: 1, open_time: '08:00:00' })
  })

  it('impede desativar barbeiro com agendamento ativo e permite após o cancelamento', async () => {
    const customerId = await createCustomer('conflito-barbeiro')
    const date = findNextOpenDate()
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '10:00'),
    )
    const barberStaffId = await createBarberStaff('guilherme')
    await activateStaffSession(staffUserId)
    const barber = (await adminBarberModule.getAdminBarbers()).find(
      (candidate) => candidate.id === 'guilherme',
    )!

    await expect(
      adminBarberModule.updateAdminBarber('guilherme', { ...barber, isActive: false }),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('10:00') })

    const [activeRows] = await applicationPool.execute<BarberActiveRow[]>(
      "SELECT is_active FROM barbers WHERE id = 'guilherme'",
    )
    const [sessionRows] = await applicationPool.execute<CountRow[]>(
      'SELECT COUNT(*) AS total FROM staff_sessions WHERE staff_user_id = ?',
      [barberStaffId],
    )
    expect(Boolean(activeRows[0].is_active)).toBe(true)
    expect(sessionRows[0].total).toBe(1)

    await appointmentModule.cancelAppointment(customerId, appointmentId)
    await expect(
      adminBarberModule.updateAdminBarber('guilherme', { ...barber, isActive: false }),
    ).resolves.toMatchObject({ id: 'guilherme', isActive: false })

    const [remainingSessions] = await applicationPool.execute<CountRow[]>(
      'SELECT COUNT(*) AS total FROM staff_sessions WHERE staff_user_id = ?',
      [barberStaffId],
    )
    expect(remainingSessions[0].total).toBe(0)
  })

  it('mantém consistência quando reserva e bloqueio são criados ao mesmo tempo', async () => {
    const customerId = await createCustomer('corrida-bloqueio')
    const date = findNextOpenDate()
    await activateStaffSession(staffUserId)

    const results = await Promise.allSettled([
      appointmentModule.createAppointment(customerId, appointmentInput(date, '11:00')),
      adminScheduleBlockModule.createAdminScheduleBlock({
        barberId: 'guilherme',
        date,
        fullDay: false,
        startTime: '11:00',
        endTime: '12:00',
        reason: 'Compromisso',
      }),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    expect(failure?.reason).toMatchObject({ status: 409 })

    const [[appointments], [blocks]] = await Promise.all([
      applicationPool.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM appointments
         WHERE barber_id = 'guilherme' AND appointment_date = ? AND appointment_time = '11:00:00'`,
        [date],
      ),
      applicationPool.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM schedule_blocks
         WHERE barber_id = 'guilherme' AND block_date = ? AND start_time = '11:00:00'`,
        [date],
      ),
    ])
    expect(appointments[0].total + blocks[0].total).toBe(1)
  })

  it('mantém consistência entre reserva e redução simultânea do expediente', async () => {
    const customerId = await createCustomer('corrida-expediente')
    const date = findNextOpenDate()
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    await activateStaffSession(staffUserId)
    const reducedHours = getDefaultBusinessHours().map((hour) =>
      hour.weekday === weekday ? { ...hour, closeTime: '09:30' } : hour,
    )

    const results = await Promise.allSettled([
      appointmentModule.createAppointment(customerId, appointmentInput(date, '09:00')),
      adminBusinessModule.updateAdminBusinessHours({ hours: reducedHours }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const [[appointments], [hours]] = await Promise.all([
      applicationPool.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM appointments
         WHERE barber_id = 'guilherme' AND appointment_date = ? AND appointment_time = '09:00:00'`,
        [date],
      ),
      applicationPool.execute<BusinessHourDatabaseRow[]>(
        'SELECT is_open, open_time, close_time FROM business_hours WHERE weekday = ?',
        [weekday],
      ),
    ])
    expect(appointments[0].total === 1).toBe(hours[0].close_time !== '09:30:00')
  })

  it('mantém consistência entre reserva e desativação simultânea do barbeiro', async () => {
    const customerId = await createCustomer('corrida-barbeiro')
    const date = findNextOpenDate()
    await activateStaffSession(staffUserId)
    const barber = (await adminBarberModule.getAdminBarbers()).find(
      (candidate) => candidate.id === 'guilherme',
    )!

    const results = await Promise.allSettled([
      appointmentModule.createAppointment(customerId, appointmentInput(date, '12:00')),
      adminBarberModule.updateAdminBarber('guilherme', { ...barber, isActive: false }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const [[appointments], [barbers]] = await Promise.all([
      applicationPool.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM appointments
         WHERE barber_id = 'guilherme' AND appointment_date = ? AND appointment_time = '12:00:00'`,
        [date],
      ),
      applicationPool.execute<BarberActiveRow[]>(
        "SELECT is_active FROM barbers WHERE id = 'guilherme'",
      ),
    ])
    expect(appointments[0].total === 1).toBe(Boolean(barbers[0].is_active))
  })

  it('autentica barbeiro vinculado e rejeita conta sem vínculo ou com perfil inativo', async () => {
    const password = 'SenhaSegura123'
    const passwordHash = await authModule.hashPassword(password)
    const linkedId = randomUUID()
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO staff_users (id, name, email, password_hash, role, barber_id, is_active)
       VALUES (?, 'Barbeiro vinculado', 'barber@example.test', ?, 'barber', 'guilherme', TRUE)`,
      [linkedId, passwordHash],
    )

    await expect(
      adminAuthModule.authenticateStaff('barber@example.test', password),
    ).resolves.toBe('barber')
    expect(staffCookies.get('gui_santos_staff_session')).toBeTruthy()

    staffCookies.clear()
    await applicationPool.query("UPDATE barbers SET is_active = FALSE WHERE id = 'guilherme'")
    await expect(
      adminAuthModule.authenticateStaff('barber@example.test', password),
    ).resolves.toBeNull()

    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO staff_users (id, name, email, password_hash, role, barber_id, is_active)
       VALUES (?, 'Barbeiro sem vínculo', 'orphan@example.test', ?, 'barber', NULL, TRUE)`,
      [randomUUID(), passwordHash],
    )
    await expect(
      adminAuthModule.authenticateStaff('orphan@example.test', password),
    ).resolves.toBeNull()
  })

  it('limita a leitura e a atualização do barbeiro à própria agenda', async () => {
    const firstCustomer = await createCustomer('equipe-a')
    const secondCustomer = await createCustomer('equipe-b')
    const date = findNextOpenDate()
    const ownAppointment = await appointmentModule.createAppointment(
      firstCustomer,
      appointmentInput(date, '09:00', 'guilherme'),
    )
    const otherAppointment = await appointmentModule.createAppointment(
      secondCustomer,
      appointmentInput(date, '09:00', 'vitor'),
    )
    await createBarberStaff('guilherme')

    const appointments = await adminAppointmentModule.getAdminAppointments(date, 'vitor')
    expect(appointments.map((appointment) => appointment.id)).toEqual([ownAppointment])

    await expect(
      adminAppointmentModule.updateAdminAppointmentStatus(otherAppointment, 'concluido'),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      adminAppointmentModule.updateAdminAppointmentStatus(ownAppointment, 'concluido'),
    ).resolves.toBe(true)
  })

  it('mantém para o administrador a visão global e o filtro por barbeiro', async () => {
    const firstCustomer = await createCustomer('admin-a')
    const secondCustomer = await createCustomer('admin-b')
    const date = findNextOpenDate()
    const firstAppointment = await appointmentModule.createAppointment(
      firstCustomer,
      appointmentInput(date, '10:00', 'guilherme'),
    )
    const secondAppointment = await appointmentModule.createAppointment(
      secondCustomer,
      appointmentInput(date, '10:00', 'vitor'),
    )
    await activateStaffSession(staffUserId)

    await expect(adminAppointmentModule.getAdminAppointments(date)).resolves.toHaveLength(2)
    await expect(
      adminAppointmentModule.getAdminAppointments(date, 'vitor'),
    ).resolves.toMatchObject([{ id: secondAppointment }])
    await expect(
      adminAppointmentModule.updateAdminAppointmentStatus(firstAppointment, 'concluido'),
    ).resolves.toBe(true)
  })

  it('isola os bloqueios do barbeiro e mantém bloqueios gerais somente para leitura', async () => {
    const barberStaffId = await createBarberStaff('guilherme')
    const date = findNextOpenDate()
    const globalBlockId = randomUUID()
    const ownAdminBlockId = randomUUID()
    const otherBlockId = randomUUID()
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO schedule_blocks
        (id, barber_id, block_date, start_time, end_time, reason, created_by)
       VALUES
        (?, NULL, ?, NULL, NULL, 'Fechamento geral', ?),
        (?, 'guilherme', ?, '09:00:00', '10:00:00', 'Bloqueio do chefe', ?),
        (?, 'vitor', ?, NULL, NULL, 'Folga do colega', ?)`,
      [
        globalBlockId,
        date,
        staffUserId,
        ownAdminBlockId,
        date,
        staffUserId,
        otherBlockId,
        date,
        staffUserId,
      ],
    )

    const visibleBlocks = await adminScheduleBlockModule.getAdminScheduleBlocks()
    expect(visibleBlocks.map((block) => block.id).sort()).toEqual(
      [globalBlockId, ownAdminBlockId].sort(),
    )
    expect(visibleBlocks.every((block) => !block.canDelete)).toBe(true)

    const personalDate = addDaysToIsoDate(date, 1)
    const created = await adminScheduleBlockModule.createAdminScheduleBlock({
      barberId: 'vitor',
      date: personalDate,
      fullDay: true,
      reason: 'Compromisso pessoal',
    })
    expect(created).toMatchObject({ barberId: 'guilherme', canDelete: true })

    await expect(
      adminScheduleBlockModule.deleteAdminScheduleBlock(globalBlockId),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      adminScheduleBlockModule.deleteAdminScheduleBlock(ownAdminBlockId),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      adminScheduleBlockModule.deleteAdminScheduleBlock(created.id),
    ).resolves.toBeUndefined()

    const [rows] = await applicationPool.execute<CountRow[]>(
      'SELECT COUNT(*) AS total FROM schedule_blocks WHERE created_by = ?',
      [barberStaffId],
    )
    expect(rows[0].total).toBe(0)
  })

  it('impede duas contas vinculadas ao mesmo barbeiro', async () => {
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO staff_users (id, name, email, password_hash, role, barber_id, is_active)
       VALUES (?, 'Primeiro acesso', 'first@example.test', 'scrypt:test', 'barber', 'guilherme', TRUE)`,
      [randomUUID()],
    )

    await expect(
      applicationPool.execute<ResultSetHeader>(
        `INSERT INTO staff_users (id, name, email, password_hash, role, barber_id, is_active)
         VALUES (?, 'Segundo acesso', 'second@example.test', 'scrypt:test', 'barber', 'guilherme', TRUE)`,
        [randomUUID()],
      ),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' })
  })

  it('permite ao chefe criar um acesso vinculado para o barbeiro', async () => {
    const adminPassword = 'SenhaDoChefe123'
    const barberPassword = 'SenhaDoBarbeiro123'
    await applicationPool.execute<ResultSetHeader>(
      'UPDATE staff_users SET password_hash = ? WHERE id = ?',
      [await authModule.hashPassword(adminPassword), staffUserId],
    )
    await activateStaffSession(staffUserId)

    const account = await adminUserModule.createStaffAccount({
      name: 'Guilherme Agenda',
      email: 'guilherme-access@example.test',
      password: barberPassword,
      role: 'barber',
      barberId: 'guilherme',
      currentPassword: adminPassword,
    })
    expect(account).toMatchObject({
      role: 'barber',
      barberId: 'guilherme',
      barberName: 'Matheus Guilherme',
      isActive: true,
    })

    staffCookies.clear()
    await expect(
      adminAuthModule.authenticateStaff('guilherme-access@example.test', barberPassword),
    ).resolves.toBe('barber')
  })

  it('recusa o barbeiro nas áreas exclusivas do administrador', async () => {
    await createBarberStaff('guilherme')

    await expect(adminServiceModule.getAdminServices()).rejects.toMatchObject({ status: 403 })
    await expect(adminBarberModule.getAdminBarbers()).rejects.toMatchObject({ status: 403 })
    await expect(adminBusinessModule.getAdminBusinessConfiguration()).rejects.toMatchObject({
      status: 403,
    })
    await expect(adminUserModule.getStaffAccounts()).rejects.toMatchObject({ status: 403 })
  })

  it('invalida a sessão do barbeiro quando o perfil é desativado', async () => {
    await createBarberStaff('guilherme')
    const barberToken = staffCookies.get('gui_santos_staff_session')
    expect(barberToken).toBeTruthy()

    await activateStaffSession(staffUserId)
    const adminToken = staffCookies.get('gui_santos_staff_session')
    const barber = (await adminBarberModule.getAdminBarbers()).find(
      (candidate) => candidate.id === 'guilherme',
    )
    expect(barber).toBeTruthy()

    await adminBarberModule.updateAdminBarber('guilherme', {
      ...barber,
      isActive: false,
    })

    staffCookies.set('gui_santos_staff_session', barberToken!)
    await expect(adminAuthModule.getAuthenticatedStaff()).resolves.toBeNull()

    staffCookies.set('gui_santos_staff_session', adminToken!)
    await adminBarberModule.updateAdminBarber('guilherme', {
      ...barber,
      isActive: true,
    })

    staffCookies.set('gui_santos_staff_session', barberToken!)
    await expect(adminAuthModule.getAuthenticatedStaff()).resolves.toBeNull()
  })
})
