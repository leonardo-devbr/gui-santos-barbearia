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

const name = (process.env.ADMIN_NAME ?? '').trim().replace(/\s+/g, ' ')
const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD ?? ''
const databaseName = process.env.MYSQL_DATABASE?.trim() || 'gui_santos_barbearia'
const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1'
const port = Number(process.env.MYSQL_PORT ?? 3306)
const user = process.env.MYSQL_USER?.trim() || 'root'

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('MYSQL_PORT deve ser uma porta válida.')
}
if (process.env.NODE_ENV === 'production') {
  const missing = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'].filter(
    (key) => !process.env[key]?.trim(),
  )
  if (missing.length > 0) throw new Error(`Configure ${missing.join(', ')} em produção.`)
  if (!isLoopbackHost(host) && !process.env.MYSQL_PASSWORD) {
    throw new Error('MYSQL_PASSWORD não pode ficar vazia para um banco remoto em produção.')
  }
}

if (name.length < 3 || name.length > 80) {
  throw new Error('ADMIN_NAME deve ter entre 3 e 80 caracteres.')
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  throw new Error('ADMIN_EMAIL deve ser um e-mail válido.')
}

if (password.length < 12 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
  throw new Error('ADMIN_PASSWORD deve ter ao menos 12 caracteres, incluindo uma letra e um número.')
}

if (password.length > 128) {
  throw new Error('ADMIN_PASSWORD deve ter no máximo 128 caracteres.')
}

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('MYSQL_DATABASE deve conter apenas letras, números e sublinhado.')
}

const salt = randomBytes(16).toString('hex')
const derivedKey = await scrypt(password, salt, 64)
const passwordHash = `scrypt$${salt}$${Buffer.from(derivedKey).toString('hex')}`
const ssl = getSslConfig(host)
const connection = await mysql.createConnection({
  host,
  port,
  user,
  password: process.env.MYSQL_PASSWORD ?? '',
  database: databaseName,
  ...(ssl ? { ssl } : {}),
  charset: 'utf8mb4',
  timezone: 'Z',
})

try {
  await connection.beginTransaction()
  await connection.execute(
    `INSERT INTO staff_users (id, name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 'admin', TRUE)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       password_hash = VALUES(password_hash),
       role = 'admin',
       is_active = TRUE`,
    [randomUUID(), name, email, passwordHash],
  )
  await connection.execute(
    `DELETE FROM staff_sessions
     WHERE staff_user_id = (SELECT id FROM staff_users WHERE email = ? LIMIT 1)`,
    [email],
  )
  await connection.commit()
  console.log(`Administrador ${email} criado ou atualizado com sucesso.`)
} catch (error) {
  await connection.rollback()
  throw error
} finally {
  await connection.end()
}
