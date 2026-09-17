import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

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

const databaseName = process.env.MYSQL_DATABASE?.trim() || 'gui_santos_barbearia'
const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1'
const port = Number(process.env.MYSQL_PORT ?? 3306)
const applicationUser = process.env.MYSQL_USER?.trim() || 'root'
const setupUser = process.env.MYSQL_SETUP_USER?.trim()

if (process.env.MYSQL_SETUP_PASSWORD !== undefined && !setupUser) {
  throw new Error('MYSQL_SETUP_PASSWORD exige MYSQL_SETUP_USER.')
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('MYSQL_PORT deve ser uma porta válida.')
}

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('MYSQL_DATABASE deve conter apenas letras, números e sublinhado.')
}

const ssl = getSslConfig(host)
const connectionOptions = {
  host,
  port,
  user: setupUser || applicationUser,
  password: setupUser
    ? (process.env.MYSQL_SETUP_PASSWORD ?? '')
    : (process.env.MYSQL_PASSWORD ?? ''),
  ...(ssl ? { ssl } : {}),
  charset: 'utf8mb4',
  timezone: 'Z',
}

const schemaPath = fileURLToPath(new URL('../database/schema.sql', import.meta.url))
const schema = await readFile(schemaPath, 'utf8')
const bootstrapConnection = await mysql.createConnection(connectionOptions)

try {
  await bootstrapConnection.query(
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  )
} finally {
  await bootstrapConnection.end()
}

const databaseConnection = await mysql.createConnection({
  ...connectionOptions,
  database: databaseName,
  multipleStatements: true,
})

try {
  await databaseConnection.query(schema)
  console.log(`Banco ${databaseName} preparado com sucesso.`)
} finally {
  await databaseConnection.end()
}
