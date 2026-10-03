import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import mysql from 'mysql2/promise'

const scrypt = promisify(scryptCallback)

function readBooleanSetting(name, fallback) {
  const value = process.env[name]?.trim()
  if (!value) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} deve ser true ou false.`)
}

function isLoopbackHost(host) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.toLowerCase())
}

function getSslConfig(host) {
  const enabled = readBooleanSetting('MYSQL_SSL', false)
  const encodedCa = process.env.MYSQL_SSL_CA_BASE64?.trim()

  if (process.env.NODE_ENV === 'production' && !isLoopbackHost(host) && !enabled) {
    throw new Error('MYSQL_SSL deve ser true para um banco remoto em produção.')
  }
  if (!enabled) {
    if (encodedCa) throw new Error('MYSQL_SSL_CA_BASE64 exige MYSQL_SSL=true.')
    return undefined
  }

  let ca
  if (encodedCa) {
    ca = Buffer.from(encodedCa, 'base64').toString('utf8')
    if (!ca.includes('-----BEGIN CERTIFICATE-----')) {
      throw new Error('MYSQL_SSL_CA_BASE64 deve conter um certificado PEM codificado em base64.')
    }
  }

  return {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
    verifyIdentity: true,
    ...(ca ? { ca } : {}),
  }
}

function requiredSetting(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Configure ${name} antes de criar as contas de teste.`)
  return value
}

function readName(name) {
  const value = requiredSetting(name).replace(/\s+/g, ' ')
  if (value.length < 3 || value.length > 80) {
    throw new Error(`${name} deve ter entre 3 e 80 caracteres.`)
  }
  return value
}

function readEmail(name) {
  const value = requiredSetting(name).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    throw new Error(`${name} deve ser um e-mail válido.`)
  }
  return value
}

function readPassword(name) {
  const value = process.env[name] ?? ''
  if (value.length < 12 || value.length > 128 || !/[A-Za-zÀ-ÿ]/.test(value) || !/\d/.test(value)) {
    throw new Error(
      `${name} deve ter entre 12 e 128 caracteres, incluindo pelo menos uma letra e um número.`,
    )
  }
  return value
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64)
  return `scrypt$${salt}$${Buffer.from(derivedKey).toString('hex')}`
}

if (!readBooleanSetting('SEED_TEST_USERS', false)) {
  throw new Error(
    'A criação de contas de teste está desativada. Defina SEED_TEST_USERS=true somente no job de homologação.',
  )
}

const customer = {
  name: readName('SEED_CUSTOMER_NAME'),
  phone: requiredSetting('SEED_CUSTOMER_PHONE').replace(/\D/g, ''),
  email: readEmail('SEED_CUSTOMER_EMAIL'),
  password: readPassword('SEED_CUSTOMER_PASSWORD'),
}
const admin = {
  name: readName('SEED_ADMIN_NAME'),
  email: readEmail('SEED_ADMIN_EMAIL'),
  password: readPassword('SEED_ADMIN_PASSWORD'),
}
const barber = {
  name: readName('SEED_BARBER_NAME'),
  email: readEmail('SEED_BARBER_EMAIL'),
  password: readPassword('SEED_BARBER_PASSWORD'),
  barberId: requiredSetting('SEED_BARBER_ID'),
}

if (customer.phone.length < 10 || customer.phone.length > 11) {
  throw new Error('SEED_CUSTOMER_PHONE deve conter DDD e telefone, com 10 ou 11 dígitos.')
}
if (!/^[A-Za-z0-9_-]{1,64}$/.test(barber.barberId)) {
  throw new Error('SEED_BARBER_ID contém caracteres inválidos.')
}
if (new Set([customer.email, admin.email, barber.email]).size !== 3) {
  throw new Error('As três contas de teste precisam usar e-mails diferentes.')
}

const databaseName = process.env.MYSQL_DATABASE?.trim() || 'gui_santos_barbearia'
const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1'
const port = Number(process.env.MYSQL_PORT ?? 3306)
const user = process.env.MYSQL_USER?.trim() || 'root'
const mysqlPassword = process.env.MYSQL_PASSWORD ?? ''

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('MYSQL_PORT deve ser uma porta válida.')
}
if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('MYSQL_DATABASE deve conter apenas letras, números e sublinhado.')
}
if (process.env.NODE_ENV === 'production') {
  const missing = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'].filter(
    (key) => !process.env[key]?.trim(),
  )
  if (missing.length > 0) throw new Error(`Configure ${missing.join(', ')} em produção.`)
  if (!mysqlPassword) throw new Error('MYSQL_PASSWORD não pode ficar vazia em produção.')
  if (user.toLowerCase() === 'root') {
    throw new Error('MYSQL_USER deve usar uma conta exclusiva da aplicação em produção.')
  }
}

const [customerPasswordHash, adminPasswordHash, barberPasswordHash] = await Promise.all([
  hashPassword(customer.password),
  hashPassword(admin.password),
  hashPassword(barber.password),
])
const ssl = getSslConfig(host)
const connection = await mysql.createConnection({
  host,
  port,
  user,
  password: mysqlPassword,
  database: databaseName,
  ...(ssl ? { ssl } : {}),
  charset: 'utf8mb4',
  timezone: 'Z',
})

try {
  await connection.beginTransaction()

  const [barberProfiles] = await connection.execute(
    'SELECT id FROM barbers WHERE id = ? AND is_active = TRUE LIMIT 1 FOR UPDATE',
    [barber.barberId],
  )
  if (!barberProfiles[0]) {
    throw new Error(`O barbeiro ${barber.barberId} não existe ou está desativado.`)
  }

  await connection.execute(
    `INSERT INTO customers
       (id, name, phone, email, email_verified_at, password_hash)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       phone = VALUES(phone),
       password_hash = VALUES(password_hash),
       email_verified_at = UTC_TIMESTAMP(),
       pending_email = NULL`,
    [randomUUID(), customer.name, customer.phone, customer.email, customerPasswordHash],
  )
  const [[customerRow]] = await connection.execute(
    'SELECT id FROM customers WHERE email = ? LIMIT 1',
    [customer.email],
  )
  await connection.execute('DELETE FROM sessions WHERE customer_id = ?', [customerRow.id])
  await connection.execute('DELETE FROM password_reset_tokens WHERE customer_id = ?', [
    customerRow.id,
  ])
  await connection.execute('DELETE FROM email_verification_tokens WHERE customer_id = ?', [
    customerRow.id,
  ])

  await connection.execute(
    `INSERT INTO staff_users (id, name, email, password_hash, role, barber_id, is_active)
     VALUES (?, ?, ?, ?, 'admin', NULL, TRUE)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       role = 'admin',
       barber_id = NULL,
       is_active = TRUE`,
    [randomUUID(), admin.name, admin.email, adminPasswordHash],
  )
  const [[adminRow]] = await connection.execute(
    'SELECT id FROM staff_users WHERE email = ? LIMIT 1',
    [admin.email],
  )
  await connection.execute('DELETE FROM staff_sessions WHERE staff_user_id = ?', [adminRow.id])

  const [matchingStaff] = await connection.execute(
    `SELECT id, email, barber_id
     FROM staff_users
     WHERE email = ? OR barber_id = ?
     FOR UPDATE`,
    [barber.email, barber.barberId],
  )
  const byEmail = matchingStaff.find((row) => row.email === barber.email)
  const byBarber = matchingStaff.find((row) => row.barber_id === barber.barberId)
  if (byEmail && byBarber && byEmail.id !== byBarber.id) {
    throw new Error('O e-mail e o perfil escolhidos pertencem a contas diferentes da equipe.')
  }

  const barberStaffId = byEmail?.id || byBarber?.id || randomUUID()
  if (byEmail || byBarber) {
    await connection.execute(
      `UPDATE staff_users
       SET name = ?, email = ?, password_hash = ?, role = 'barber', barber_id = ?, is_active = TRUE
       WHERE id = ?`,
      [barber.name, barber.email, barberPasswordHash, barber.barberId, barberStaffId],
    )
  } else {
    await connection.execute(
      `INSERT INTO staff_users (id, name, email, password_hash, role, barber_id, is_active)
       VALUES (?, ?, ?, ?, 'barber', ?, TRUE)`,
      [barberStaffId, barber.name, barber.email, barberPasswordHash, barber.barberId],
    )
  }
  await connection.execute('DELETE FROM staff_sessions WHERE staff_user_id = ?', [barberStaffId])

  await connection.commit()
  console.log('Contas de teste criadas ou atualizadas com sucesso:')
  console.log(`- cliente: ${customer.email}`)
  console.log(`- administrador: ${admin.email}`)
  console.log(`- barbeiro: ${barber.email} (${barber.barberId})`)
} catch (error) {
  await connection.rollback()
  throw error
} finally {
  await connection.end()
}
