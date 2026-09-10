import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const databaseName = process.env.MYSQL_DATABASE ?? 'gui_santos_barbearia'

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('MYSQL_DATABASE deve conter apenas letras, números e sublinhado.')
}

const connectionOptions = {
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
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
