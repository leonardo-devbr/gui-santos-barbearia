import 'server-only'

import mysql, { type Pool, type PoolConnection, type PoolOptions } from 'mysql2/promise'

declare global {
  var mysqlPool: Pool | undefined
}

function readBooleanSetting(name: string, fallback: boolean) {
  const value = process.env[name]?.trim()
  if (!value) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} deve ser true ou false.`)
}

function isLoopbackHost(host: string) {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host.toLowerCase())
}

function getSslConfig(host: string): PoolOptions['ssl'] | undefined {
  const enabled = readBooleanSetting('MYSQL_SSL', false)
  const encodedCa = process.env.MYSQL_SSL_CA_BASE64?.trim()

  if (process.env.NODE_ENV === 'production' && !isLoopbackHost(host) && !enabled) {
    throw new Error('MYSQL_SSL deve ser true para um banco remoto em produção.')
  }
  if (!enabled) {
    if (encodedCa) throw new Error('MYSQL_SSL_CA_BASE64 exige MYSQL_SSL=true.')
    return undefined
  }

  let ca: string | undefined
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

function getDatabaseConfig() {
  const port = Number(process.env.MYSQL_PORT ?? 3306)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MYSQL_PORT deve ser uma porta válida.')
  }

  const host = process.env.MYSQL_HOST?.trim() || '127.0.0.1'
  const user = process.env.MYSQL_USER?.trim() || 'root'
  const password = process.env.MYSQL_PASSWORD ?? ''
  const database = process.env.MYSQL_DATABASE?.trim() || 'gui_santos_barbearia'

  if (process.env.NODE_ENV === 'production') {
    const missing = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'].filter(
      (name) => !process.env[name]?.trim(),
    )
    if (missing.length > 0) {
      throw new Error(`Configure ${missing.join(', ')} no ambiente de produção.`)
    }
    if (!password) throw new Error('MYSQL_PASSWORD não pode ficar vazia em produção.')
    if (user.toLowerCase() === 'root') {
      throw new Error('MYSQL_USER deve usar uma conta exclusiva da aplicação em produção.')
    }
  }

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: getSslConfig(host),
  }
}

export function getPool() {
  if (!global.mysqlPool) {
    const config = getDatabaseConfig()
    global.mysqlPool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ...(config.ssl ? { ssl: config.ssl } : {}),
      charset: 'utf8mb4',
      timezone: 'Z',
      dateStrings: true,
      decimalNumbers: true,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60_000,
      enableKeepAlive: true,
    })
  }

  return global.mysqlPool
}

function isDeadlockError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ER_LOCK_DEADLOCK',
  )
}

export async function withTransaction<T>(work: (connection: PoolConnection) => Promise<T>) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const connection = await getPool().getConnection()

    try {
      await connection.beginTransaction()
      const result = await work(connection)
      await connection.commit()
      return result
    } catch (error) {
      lastError = error
      await connection.rollback()
      if (!isDeadlockError(error) || attempt === 3) throw error
    } finally {
      connection.release()
    }
  }

  throw lastError instanceof Error ? lastError : new Error('A transação não pôde ser concluída.')
}
