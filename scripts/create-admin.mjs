import { randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto'
import { promisify } from 'node:util'
import mysql from 'mysql2/promise'

const scrypt = promisify(scryptCallback)
const name = (process.env.ADMIN_NAME ?? '').trim().replace(/\s+/g, ' ')
const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD ?? ''
const databaseName = process.env.MYSQL_DATABASE ?? 'gui_santos_barbearia'

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
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: databaseName,
  charset: 'utf8mb4',
  timezone: 'Z',
})

try {
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
  console.log(`Administrador ${email} criado ou atualizado com sucesso.`)
} finally {
  await connection.end()
}
