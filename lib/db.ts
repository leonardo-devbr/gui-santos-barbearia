import 'server-only'

import mysql, { type Pool, type PoolConnection } from 'mysql2/promise'

declare global {
  var mysqlPool: Pool | undefined
}

function getDatabaseConfig() {
  const port = Number(process.env.MYSQL_PORT ?? 3306)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('MYSQL_PORT deve ser uma porta válida.')
  }

  return {
    host: process.env.MYSQL_HOST ?? '127.0.0.1',
    port,
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? 'gui_santos_barbearia',
  }
}

export function getPool() {
  if (!global.mysqlPool) {
    global.mysqlPool = mysql.createPool({
      ...getDatabaseConfig(),
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

export async function withTransaction<T>(work: (connection: PoolConnection) => Promise<T>) {
  const connection = await getPool().getConnection()

  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
