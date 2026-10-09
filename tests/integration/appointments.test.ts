import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mysql, {
  type Connection,
  type Pool,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
  notification_revision: number
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

interface SchemaColumnRow extends RowDataPacket {
  columnName: string
  columnType: string
  generationExpression: string
}

interface WhatsAppNotificationDatabaseRow extends RowDataPacket {
  id: string
  appointment_revision: number
  event: string
  audience: string
  recipient_kind: string
  recipient_id: string
  status: string
  attempts: number
  scheduled_for: string
  next_attempt_at: string
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
  'WHATSAPP_PROVIDER',
  'WHATSAPP_TEST_RECIPIENT',
  'WHATSAPP_GRAPH_API_VERSION',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
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
let whatsappNotificationModule: typeof import('@/lib/whatsapp-notifications')

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

function findPreviousOpenDate() {
  let date = addDaysToIsoDate(getTodayInSaoPaulo(), -1)

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    if (weekday >= 2 && weekday <= 6) return date
    date = addDaysToIsoDate(date, -1)
  }

  throw new Error('Não foi possível encontrar um dia anterior de atendimento para o teste.')
}

function findOpenDateAtLeast(daysAhead: number) {
  let date = addDaysToIsoDate(getTodayInSaoPaulo(), daysAhead)

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    if (weekday >= 2 && weekday <= 6) return date
    date = addDaysToIsoDate(date, 1)
  }

  throw new Error('Não foi possível encontrar um dia futuro de atendimento para o teste.')
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
  whatsappNotificationModule = await import('@/lib/whatsapp-notifications')
  applicationPool = databaseModule.getPool()
})

beforeEach(async () => {
  staffCookies.clear()
  process.env.WHATSAPP_PROVIDER = 'console'
  delete process.env.WHATSAPP_TEST_RECIPIENT
  delete process.env.WHATSAPP_GRAPH_API_VERSION
  delete process.env.WHATSAPP_PHONE_NUMBER_ID
  delete process.env.WHATSAPP_ACCESS_TOKEN
  for (const table of [
    'whatsapp_notifications',
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

afterEach(() => {
  vi.unstubAllGlobals()
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
         AND status = 'confirmado'`,
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
         AND status = 'confirmado'`,
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

  it('oculta conflitos do próprio cliente e libera somente sua remarcação', async () => {
    const customerId = await createCustomer('disponibilidade-cliente')
    const otherCustomerId = await createCustomer('disponibilidade-terceiro')
    const date = findNextOpenDate()
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '11:00', 'vitor'),
    )
    const foreignAppointmentId = await appointmentModule.createAppointment(
      otherCustomerId,
      appointmentInput(date, '15:00', 'vitor'),
    )

    const slots = await appointmentModule.getAvailability({
      customerId,
      serviceId: 'corte',
      barberId: 'guilherme',
      date,
    })
    expect(slots.find((slot) => slot.time === '11:00')?.available).toBe(false)
    expect(slots.find((slot) => slot.time === '11:30')?.available).toBe(false)
    expect(slots.find((slot) => slot.time === '15:00')?.available).toBe(true)

    const reschedulingSlots = await appointmentModule.getAvailability({
      customerId,
      appointmentId,
      serviceId: 'corte',
      barberId: 'guilherme',
      date,
    })
    expect(reschedulingSlots.find((slot) => slot.time === '11:00')?.available).toBe(true)
    expect(reschedulingSlots.find((slot) => slot.time === '11:30')?.available).toBe(true)

    const foreignReschedulingSlots = await appointmentModule.getAvailability({
      customerId,
      appointmentId: foreignAppointmentId,
      serviceId: 'corte',
      barberId: 'guilherme',
      date,
    })
    expect(foreignReschedulingSlots.find((slot) => slot.time === '11:00')?.available).toBe(false)
  })

  it('reflete o conflito do cliente no calendário mensal e exclui sua remarcação', async () => {
    const customerId = await createCustomer('calendario-cliente')
    const date = findNextOpenDate()
    const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
    await applicationPool.execute<ResultSetHeader>(
      `UPDATE business_hours
       SET is_open = TRUE, open_time = '09:00:00', close_time = '10:00:00'
       WHERE weekday = ?`,
      [weekday],
    )
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '09:00', 'vitor'),
    )

    const [day] = await appointmentModule.getAvailabilityForPeriod({
      customerId,
      serviceId: 'corte',
      barberId: 'guilherme',
      from: date,
      to: date,
    })
    expect(day).toEqual({ date, status: 'full' })

    const [reschedulingDay] = await appointmentModule.getAvailabilityForPeriod({
      customerId,
      appointmentId,
      serviceId: 'corte',
      barberId: 'guilherme',
      from: date,
      to: date,
    })
    expect(reschedulingDay).toEqual({ date, status: 'available' })
  })

  it('resume um período do calendário distinguindo dias fechados, lotados e disponíveis', async () => {
    const customerId = await createCustomer('calendario')
    const from = addDaysToIsoDate(getTodayInSaoPaulo(), 1)
    const to = addDaysToIsoDate(from, 7)
    const dates = Array.from({ length: 8 }, (_, offset) => addDaysToIsoDate(from, offset))
    const openDates = dates.filter((date) => {
      const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
      return weekday >= 2 && weekday <= 6
    })
    const closedDate = dates.find((date) => {
      const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay()
      return weekday < 2
    })
    expect(openDates.length).toBeGreaterThanOrEqual(2)
    expect(closedDate).toBeTruthy()

    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO schedule_blocks
        (id, barber_id, block_date, start_time, end_time, reason, created_by)
       VALUES (?, 'guilherme', ?, NULL, NULL, 'Folga', ?)`,
      [randomUUID(), openDates[0], staffUserId],
    )

    const days = await appointmentModule.getAvailabilityForPeriod({
      customerId,
      serviceId: 'corte',
      barberId: 'guilherme',
      from,
      to,
    })
    const statusByDate = new Map(days.map((day) => [day.date, day.status]))

    expect(days).toHaveLength(8)
    expect(statusByDate.get(openDates[0])).toBe('full')
    expect(statusByDate.get(openDates[1])).toBe('available')
    expect(statusByDate.get(closedDate!)).toBe('closed')
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

  it('mantém agendamento passado confirmado até a equipe finalizar', async () => {
    const customerId = await createCustomer('finalizacao-manual')
    const date = findPreviousOpenDate()
    const appointmentId = randomUUID()
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO appointments
        (id, customer_id, service_id, barber_id, appointment_date, appointment_time,
         status, price, duration_minutes)
       VALUES (?, ?, 'corte', 'guilherme', ?, '09:00:00', 'confirmado', 40, 45)`,
      [appointmentId, customerId, date],
    )

    const [history, upcoming] = await Promise.all([
      appointmentModule.getAppointments(customerId, 'history'),
      appointmentModule.getAppointments(customerId, 'upcoming'),
    ])
    expect(history).toMatchObject([{ id: appointmentId, status: 'confirmado' }])
    expect(upcoming).toHaveLength(0)
  })

  it('usa somente confirmado, concluído e cancelado no esquema de agendamentos', async () => {
    const [columns] = await applicationPool.execute<SchemaColumnRow[]>(
      `SELECT
         column_name AS columnName,
         column_type AS columnType,
         generation_expression AS generationExpression
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'appointments'
         AND column_name IN ('status', 'active_slot')`,
    )
    const status = columns.find((column) => column.columnName === 'status')
    const activeSlot = columns.find((column) => column.columnName === 'active_slot')

    expect(status?.columnType).toBe("enum('confirmado','concluido','cancelado')")
    expect(activeSlot?.generationExpression).toContain('`status`')
    expect(activeSlot?.generationExpression).toContain('confirmado')
    expect(activeSlot?.generationExpression).not.toContain('pendente')
  })
})

describe('fila de avisos do WhatsApp com MySQL', () => {
  async function enableCustomerWhatsApp(customerId: string) {
    await applicationPool.execute<ResultSetHeader>(
      `UPDATE customers
       SET whatsapp_opt_in = TRUE, whatsapp_opted_in_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [customerId],
    )
  }

  async function enableStaffWhatsApp(staffId: string, phone: string) {
    await applicationPool.execute<ResultSetHeader>(
      `UPDATE staff_users
       SET notification_phone = ?, whatsapp_opt_in = TRUE,
         whatsapp_opted_in_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [phone, staffId],
    )
  }

  async function queueCreatedAppointment(customerId: string, barberId = 'guilherme') {
    const date = findOpenDateAtLeast(8)
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '14:00', barberId),
    )
    let [rows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
        scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ?
       ORDER BY scheduled_for, created_at, id`,
      [appointmentId],
    )
    if (rows.length === 0) {
      await databaseModule.withTransaction((connection) =>
        whatsappNotificationModule.queueAppointmentWhatsAppNotifications(connection, {
          appointmentId,
          event: 'appointment_created',
        }),
      )
      const [queuedRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
        `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
          scheduled_for, next_attempt_at
         FROM whatsapp_notifications
         WHERE appointment_id = ?
         ORDER BY scheduled_for, created_at, id`,
        [appointmentId],
      )
      rows = queuedRows
    }
    const immediateNotificationIds = rows
      .filter(({ event }) => event === 'appointment_created')
      .map(({ id }) => id)
    const queued = {
      revision: 1,
      notificationIds: rows.map(({ id }) => id),
      immediateNotificationIds,
      eventQueued: immediateNotificationIds.length,
      remindersQueued: rows.length - immediateNotificationIds.length,
    }
    return { appointmentId, queued }
  }

  it('enfileira evento e lembretes para cliente, barbeiro e todos os administradores elegíveis', async () => {
    const customerId = await createCustomer('whatsapp-publicos')
    await enableCustomerWhatsApp(customerId)
    const barberStaffId = await createBarberStaff('guilherme')
    await enableStaffWhatsApp(barberStaffId, '15988887777')
    await enableStaffWhatsApp(staffUserId, '15999998888')

    const { appointmentId, queued } = await queueCreatedAppointment(customerId)
    expect(queued).toMatchObject({
      revision: 1,
      eventQueued: 3,
      remindersQueued: 6,
    })
    expect(queued.notificationIds).toHaveLength(9)
    expect(queued.immediateNotificationIds).toHaveLength(3)

    const [rows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
        scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ?
       ORDER BY event, audience, recipient_id`,
      [appointmentId],
    )
    expect(rows.filter(({ event }) => event === 'appointment_created')).toHaveLength(3)
    expect(rows.filter(({ event }) => event === 'reminder_24h')).toHaveLength(3)
    expect(rows.filter(({ event }) => event === 'reminder_2h')).toHaveLength(3)
    expect(new Set(rows.map(({ audience }) => audience))).toEqual(
      new Set(['customer', 'barber', 'admin']),
    )

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const outcomes =
      await whatsappNotificationModule.processImmediateAppointmentWhatsAppNotifications(
        appointmentId,
      )
    expect(outcomes).toEqual(['previewed', 'previewed', 'previewed'])
    expect(consoleSpy).toHaveBeenCalledTimes(3)

    const [deliveredRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
        scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE id IN (?, ?, ?)`,
      queued.immediateNotificationIds,
    )
    expect(deliveredRows.every(({ status, attempts }) => status === 'previewed' && attempts === 1))
      .toBe(true)

    const duplicate = await databaseModule.withTransaction((connection) =>
      whatsappNotificationModule.queueAppointmentWhatsAppNotifications(connection, {
        appointmentId,
        event: 'appointment_created',
      }),
    )
    expect(duplicate).toMatchObject({ eventQueued: 0, remindersQueued: 0 })
    const [countRows] = await applicationPool.execute<CountRow[]>(
      'SELECT COUNT(*) AS total FROM whatsapp_notifications WHERE appointment_id = ?',
      [appointmentId],
    )
    expect(countRows[0].total).toBe(9)
  })

  it('substitui avisos antigos e notifica as duas agendas em uma remarcação real', async () => {
    const customerId = await createCustomer('whatsapp-remarcacao-real')
    await enableCustomerWhatsApp(customerId)
    const previousStaffId = await createBarberStaff('guilherme')
    await enableStaffWhatsApp(previousStaffId, '15977776666')
    const currentStaffId = await createBarberStaff('vitor')
    await enableStaffWhatsApp(currentStaffId, '15988887777')
    await enableStaffWhatsApp(staffUserId, '15999998888')
    const date = findOpenDateAtLeast(8)
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '14:00', 'guilherme'),
    )

    await expect(
      appointmentModule.rescheduleAppointment(
        customerId,
        appointmentId,
        appointmentInput(date, '16:00', 'vitor'),
      ),
    ).resolves.toBe(true)

    const [appointmentRows] = await applicationPool.execute<AppointmentDatabaseRow[]>(
      'SELECT * FROM appointments WHERE id = ?',
      [appointmentId],
    )
    expect(appointmentRows[0]).toMatchObject({
      barber_id: 'vitor',
      appointment_time: '16:00:00',
      notification_revision: 2,
    })

    const [rows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, appointment_revision, event, audience, recipient_kind, recipient_id,
        status, attempts, scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ?`,
      [appointmentId],
    )
    const oldRows = rows.filter(({ appointment_revision }) => appointment_revision === 1)
    expect(oldRows.length).toBeGreaterThan(0)
    expect(oldRows.every(({ status }) => status === 'superseded')).toBe(true)
    const currentRows = rows.filter(({ appointment_revision }) => appointment_revision === 2)
    expect(currentRows.filter(({ event }) => event === 'appointment_rescheduled')).toHaveLength(4)
    expect(currentRows.filter(({ event }) => event === 'reminder_24h')).toHaveLength(3)
    expect(currentRows.filter(({ event }) => event === 'reminder_2h')).toHaveLength(3)
    expect(
      currentRows.some(
        ({ event, recipient_id }) =>
          event === 'appointment_rescheduled' && recipient_id === previousStaffId,
      ),
    ).toBe(true)
  })

  it('cancela de forma transacional e invalida os lembretes anteriores', async () => {
    const customerId = await createCustomer('whatsapp-cancelamento-real')
    await enableCustomerWhatsApp(customerId)
    const barberStaffId = await createBarberStaff('guilherme')
    await enableStaffWhatsApp(barberStaffId, '15988887777')
    await enableStaffWhatsApp(staffUserId, '15999998888')
    const date = findOpenDateAtLeast(8)
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '14:00'),
    )

    await appointmentModule.cancelAppointment(customerId, appointmentId)

    const [appointmentRows] = await applicationPool.execute<AppointmentDatabaseRow[]>(
      'SELECT * FROM appointments WHERE id = ?',
      [appointmentId],
    )
    expect(appointmentRows[0]).toMatchObject({
      status: 'cancelado',
      notification_revision: 2,
    })
    const [rows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, appointment_revision, event, audience, recipient_kind, recipient_id,
        status, attempts, scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ?`,
      [appointmentId],
    )
    expect(
      rows
        .filter(({ appointment_revision }) => appointment_revision === 1)
        .every(({ status }) => status === 'superseded'),
    ).toBe(true)
    expect(
      rows.filter(
        ({ appointment_revision, event }) =>
          appointment_revision === 2 && event === 'appointment_cancelled',
      ),
    ).toHaveLength(3)
    expect(
      rows.some(
        ({ appointment_revision, event }) =>
          appointment_revision === 2 && event.startsWith('reminder_'),
      ),
    ).toBe(false)
  })

  it('encerra os lembretes sem criar um evento inexistente ao concluir', async () => {
    const customerId = await createCustomer('whatsapp-conclusao-real')
    await enableCustomerWhatsApp(customerId)
    await enableStaffWhatsApp(staffUserId, '15999998888')
    const date = findPreviousOpenDate()
    const appointmentId = randomUUID()
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO appointments
        (id, customer_id, service_id, barber_id, appointment_date, appointment_time,
         status, price, duration_minutes)
       VALUES (?, ?, 'corte', 'guilherme', ?, '09:00:00', 'confirmado', 40, 45)`,
      [appointmentId, customerId, date],
    )
    await databaseModule.withTransaction((connection) =>
      whatsappNotificationModule.queueAppointmentWhatsAppNotifications(connection, {
        appointmentId,
        event: 'appointment_created',
      }),
    )
    await activateStaffSession(staffUserId)

    await expect(
      adminAppointmentModule.updateAdminAppointmentStatus(appointmentId, 'concluido'),
    ).resolves.toBe(true)

    const [appointmentRows] = await applicationPool.execute<AppointmentDatabaseRow[]>(
      'SELECT * FROM appointments WHERE id = ?',
      [appointmentId],
    )
    expect(appointmentRows[0]).toMatchObject({
      status: 'concluido',
      notification_revision: 2,
    })
    const [rows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, appointment_revision, event, audience, recipient_kind, recipient_id,
        status, attempts, scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ?`,
      [appointmentId],
    )
    expect(rows.every(({ status }) => status === 'superseded')).toBe(true)
    expect(rows.some(({ appointment_revision }) => appointment_revision === 2)).toBe(false)
  })

  it('avisa o barbeiro anterior na remarcação sem criar lembretes para a agenda antiga', async () => {
    const customerId = await createCustomer('whatsapp-troca-barbeiro')
    await enableCustomerWhatsApp(customerId)
    const previousStaffId = await createBarberStaff('vitor')
    await enableStaffWhatsApp(previousStaffId, '15977776666')
    const currentStaffId = await createBarberStaff('guilherme')
    await enableStaffWhatsApp(currentStaffId, '15988887777')
    await enableStaffWhatsApp(staffUserId, '15999998888')
    const date = findOpenDateAtLeast(8)
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '15:00', 'vitor'),
    )

    const queued = await databaseModule.withTransaction(async (connection) => {
      await connection.execute<ResultSetHeader>(
        "UPDATE appointments SET barber_id = 'guilherme' WHERE id = ?",
        [appointmentId],
      )
      await whatsappNotificationModule.incrementAppointmentNotificationRevision(
        connection,
        appointmentId,
      )
      return whatsappNotificationModule.queueAppointmentWhatsAppNotifications(connection, {
        appointmentId,
        event: 'appointment_rescheduled',
        previousBarberId: 'vitor',
      })
    })
    expect(queued).toMatchObject({ revision: 2, eventQueued: 4, remindersQueued: 6 })

    const [previousBarberRows] =
      await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
        `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
          scheduled_for, next_attempt_at
         FROM whatsapp_notifications
         WHERE appointment_id = ? AND recipient_id = ?
           AND event = 'appointment_rescheduled'`,
        [appointmentId, previousStaffId],
      )
    expect(previousBarberRows).toHaveLength(1)
    expect(previousBarberRows[0]).toMatchObject({
      event: 'appointment_rescheduled',
      audience: 'barber',
    })
  })

  it('revalida consentimento e revisão antes de qualquer envio', async () => {
    const customerId = await createCustomer('whatsapp-revalidacao')
    await enableCustomerWhatsApp(customerId)
    await enableStaffWhatsApp(staffUserId, '15999998888')
    const { appointmentId, queued } = await queueCreatedAppointment(customerId)
    const [eventRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
        scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ? AND event = 'appointment_created' AND audience = 'customer'`,
      [appointmentId],
    )
    const customerNotificationId = eventRows[0].id

    await applicationPool.execute<ResultSetHeader>(
      `UPDATE customers
       SET whatsapp_opt_in = FALSE, whatsapp_opted_out_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [customerId],
    )
    await expect(
      whatsappNotificationModule.deliverWhatsAppNotification(customerNotificationId),
    ).resolves.toBe('skipped')

    await applicationPool.execute<ResultSetHeader>(
      `UPDATE customers
       SET whatsapp_opt_in = TRUE, whatsapp_opted_in_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [customerId],
    )
    const secondImmediateId = queued.immediateNotificationIds.find(
      (id) => id !== customerNotificationId,
    )
    if (secondImmediateId) {
      await databaseModule.withTransaction((connection) =>
        whatsappNotificationModule.incrementAppointmentNotificationRevision(
          connection,
          appointmentId,
        ),
      )
      await expect(
        whatsappNotificationModule.deliverWhatsAppNotification(secondImmediateId),
      ).resolves.toBe('skipped')
    }

    const [updatedRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
        scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE id = ?`,
      [customerNotificationId],
    )
    expect(updatedRows[0]).toMatchObject({ status: 'skipped', attempts: 0 })
  })

  it('não envia dados da agenda depois que o acesso muda de barbeiro', async () => {
    const customerId = await createCustomer('whatsapp-vinculo-barbeiro')
    const barberStaffId = await createBarberStaff('guilherme')
    await enableStaffWhatsApp(barberStaffId, '15988887777')
    const date = findOpenDateAtLeast(8)
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '14:00', 'guilherme'),
    )
    const [rows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, appointment_revision, event, audience, recipient_kind, recipient_id,
        status, attempts, scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ?
         AND event = 'appointment_created'
         AND audience = 'barber'
       LIMIT 1`,
      [appointmentId],
    )
    expect(rows).toHaveLength(1)

    await applicationPool.execute<ResultSetHeader>(
      "UPDATE staff_users SET barber_id = 'vitor' WHERE id = ?",
      [barberStaffId],
    )

    await expect(
      whatsappNotificationModule.deliverWhatsAppNotification(rows[0].id),
    ).resolves.toBe('skipped')
    const [updatedRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, appointment_revision, event, audience, recipient_kind, recipient_id,
        status, attempts, scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE id = ?`,
      [rows[0].id],
    )
    expect(updatedRows[0]).toMatchObject({ status: 'skipped', attempts: 0 })
  })

  it('mantém o aviso pendente quando o provedor está desativado', async () => {
    const customerId = await createCustomer('whatsapp-provedor-pausado')
    await enableCustomerWhatsApp(customerId)
    const date = findOpenDateAtLeast(8)
    const appointmentId = await appointmentModule.createAppointment(
      customerId,
      appointmentInput(date, '14:00'),
    )
    const [rows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, appointment_revision, event, audience, recipient_kind, recipient_id,
        status, attempts, scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE appointment_id = ?
         AND event = 'appointment_created'
         AND audience = 'customer'
       LIMIT 1`,
      [appointmentId],
    )
    process.env.WHATSAPP_PROVIDER = 'disabled'

    await expect(
      whatsappNotificationModule.deliverWhatsAppNotification(rows[0].id),
    ).resolves.toBe('paused')
    const [updatedRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, appointment_revision, event, audience, recipient_kind, recipient_id,
        status, attempts, scheduled_for, next_attempt_at
       FROM whatsapp_notifications
       WHERE id = ?`,
      [rows[0].id],
    )
    expect(updatedRows[0]).toMatchObject({ status: 'pending', attempts: 0 })
  })

  it('reagenda somente falhas transitórias e recupera um processamento abandonado', async () => {
    const customerId = await createCustomer('whatsapp-retry')
    await enableCustomerWhatsApp(customerId)
    const { queued } = await queueCreatedAppointment(customerId)
    const notificationId = queued.immediateNotificationIds[0]
    process.env.WHATSAPP_PROVIDER = 'meta'
    process.env.WHATSAPP_GRAPH_API_VERSION = 'v23.0'
    process.env.WHATSAPP_PHONE_NUMBER_ID = '1234567890'
    process.env.WHATSAPP_ACCESS_TOKEN = 'token-de-teste-seguro'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ error: { code: 131000 } }, { status: 503 }),
      ),
    )

    await expect(
      whatsappNotificationModule.deliverWhatsAppNotification(notificationId),
    ).resolves.toBe('retry_scheduled')
    const [retryRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
        scheduled_for, next_attempt_at
       FROM whatsapp_notifications WHERE id = ?`,
      [notificationId],
    )
    expect(retryRows[0].status).toBe('pending')
    expect(retryRows[0].attempts).toBe(1)
    expect(retryRows[0].next_attempt_at > retryRows[0].scheduled_for).toBe(true)

    await applicationPool.execute<ResultSetHeader>(
      `UPDATE whatsapp_notifications
       SET status = 'processing', locked_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 16 MINUTE)
       WHERE id = ?`,
      [notificationId],
    )
    const processed = await whatsappNotificationModule.processWhatsAppNotifications()
    expect(processed.recovered).toBe(1)
    expect(processed.retryScheduled).toBe(1)

    const [recoveredRows] = await applicationPool.execute<WhatsAppNotificationDatabaseRow[]>(
      `SELECT id, event, audience, recipient_kind, recipient_id, status, attempts,
        scheduled_for, next_attempt_at
       FROM whatsapp_notifications WHERE id = ?`,
      [notificationId],
    )
    expect(recoveredRows[0]).toMatchObject({ status: 'pending', attempts: 2 })
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
      adminAppointmentModule.updateAdminAppointmentStatus(ownAppointment, 'cancelado'),
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

    const appointments = await adminAppointmentModule.getAdminAppointments(date)
    expect(appointments).toHaveLength(2)
    expect(appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstAppointment, canComplete: false, canCancel: true }),
      ]),
    )
    await expect(
      adminAppointmentModule.getAdminAppointments(date, 'vitor'),
    ).resolves.toMatchObject([{ id: secondAppointment }])
    await expect(
      adminAppointmentModule.updateAdminAppointmentStatus(firstAppointment, 'concluido'),
    ).rejects.toMatchObject({
      status: 409,
      message: 'O atendimento só pode ser concluído depois do horário de início.',
    })
    await expect(
      adminAppointmentModule.updateAdminAppointmentStatus(firstAppointment, 'cancelado'),
    ).resolves.toBe(true)
  })

  it('consulta um período inclusivo da agenda em ordem cronológica', async () => {
    const customerId = await createCustomer('periodo-agenda')
    const firstDate = findNextOpenDate()
    const secondDate = addDaysToIsoDate(firstDate, 1)
    const outsideDate = addDaysToIsoDate(firstDate, 2)
    const firstId = randomUUID()
    const secondId = randomUUID()
    const outsideId = randomUUID()
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO appointments
        (id, customer_id, service_id, barber_id, appointment_date, appointment_time,
         status, price, duration_minutes)
       VALUES
        (?, ?, 'corte', 'guilherme', ?, '17:00:00', 'confirmado', 40, 45),
        (?, ?, 'barba', 'guilherme', ?, '09:00:00', 'confirmado', 35, 30),
        (?, ?, 'corte', 'guilherme', ?, '08:00:00', 'confirmado', 40, 45)`,
      [
        firstId,
        customerId,
        firstDate,
        secondId,
        customerId,
        secondDate,
        outsideId,
        customerId,
        outsideDate,
      ],
    )
    await activateStaffSession(staffUserId)

    const appointments = await adminAppointmentModule.getAdminAppointmentsForPeriod(
      firstDate,
      secondDate,
    )

    expect(appointments.map(({ id }) => id)).toEqual([firstId, secondId])
    expect(appointments[0]).toMatchObject({
      customerId,
      date: firstDate,
      time: '17:00',
    })
  })

  it('permite concluir um atendimento somente depois do horário de início', async () => {
    const customerId = await createCustomer('conclusao-equipe')
    const date = findPreviousOpenDate()
    const appointmentId = randomUUID()
    await applicationPool.execute<ResultSetHeader>(
      `INSERT INTO appointments
        (id, customer_id, service_id, barber_id, appointment_date, appointment_time,
         status, price, duration_minutes)
       VALUES (?, ?, 'corte', 'guilherme', ?, '09:00:00', 'confirmado', 40, 45)`,
      [appointmentId, customerId, date],
    )
    await activateStaffSession(staffUserId)

    await expect(adminAppointmentModule.getAdminAppointments(date)).resolves.toMatchObject([
      { id: appointmentId, canComplete: true, canCancel: true },
    ])
    await expect(
      adminAppointmentModule.updateAdminAppointmentStatus(appointmentId, 'concluido'),
    ).resolves.toBe(true)

    const [rows] = await applicationPool.execute<AppointmentDatabaseRow[]>(
      'SELECT * FROM appointments WHERE id = ?',
      [appointmentId],
    )
    expect(rows[0].status).toBe('concluido')
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
      notificationPhone: '',
      whatsappOptIn: false,
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
