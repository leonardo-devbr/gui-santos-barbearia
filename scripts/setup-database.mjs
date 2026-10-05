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
const connectionUser = setupUser || applicationUser
const connectionPassword = setupUser
  ? (process.env.MYSQL_SETUP_PASSWORD ?? '')
  : (process.env.MYSQL_PASSWORD ?? '')
const shouldCreateDatabase = readBooleanSetting('MYSQL_CREATE_DATABASE', true)

if (process.env.MYSQL_SETUP_PASSWORD !== undefined && !setupUser) {
  throw new Error('MYSQL_SETUP_PASSWORD exige MYSQL_SETUP_USER.')
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('MYSQL_PORT deve ser uma porta válida.')
}
if (process.env.NODE_ENV === 'production') {
  const missing = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'].filter(
    (key) => !process.env[key]?.trim(),
  )
  if (missing.length > 0) throw new Error(`Configure ${missing.join(', ')} em produção.`)
  if (!connectionPassword) throw new Error('A senha do MySQL não pode ficar vazia em produção.')
  if (applicationUser.toLowerCase() === 'root') {
    throw new Error('MYSQL_USER deve usar uma conta exclusiva da aplicação em produção.')
  }
}

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error('MYSQL_DATABASE deve conter apenas letras, números e sublinhado.')
}

const ssl = getSslConfig(host)
const connectionOptions = {
  host,
  port,
  user: connectionUser,
  password: connectionPassword,
  ...(ssl ? { ssl } : {}),
  charset: 'utf8mb4',
  timezone: 'Z',
}

const schemaPath = fileURLToPath(new URL('../database/schema.sql', import.meta.url))
const schema = await readFile(schemaPath, 'utf8')
if (shouldCreateDatabase) {
  const bootstrapConnection = await mysql.createConnection(connectionOptions)

  try {
    await bootstrapConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    )
  } finally {
    await bootstrapConnection.end()
  }
}

const databaseConnection = await mysql.createConnection({
  ...connectionOptions,
  database: databaseName,
  multipleStatements: true,
})

async function hasAppointmentColumn(name) {
  const [rows] = await databaseConnection.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'appointments' AND column_name = ?
     LIMIT 1`,
    [name],
  )
  return Boolean(rows[0])
}

async function hasAppointmentIndex(name) {
  const [rows] = await databaseConnection.execute(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'appointments' AND index_name = ?
     LIMIT 1`,
    [name],
  )
  return Boolean(rows[0])
}

async function hasCustomerColumn(name) {
  const [rows] = await databaseConnection.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'customers' AND column_name = ?
     LIMIT 1`,
    [name],
  )
  return Boolean(rows[0])
}

async function hasCustomerIndex(name) {
  const [rows] = await databaseConnection.execute(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'customers' AND index_name = ?
     LIMIT 1`,
    [name],
  )
  return Boolean(rows[0])
}

async function hasStaffUserIndex(name) {
  const [rows] = await databaseConnection.execute(
    `SELECT 1
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'staff_users' AND index_name = ?
     LIMIT 1`,
    [name],
  )
  return Boolean(rows[0])
}

async function hasBarberColumn(name) {
  const [rows] = await databaseConnection.execute(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'barbers' AND column_name = ?
     LIMIT 1`,
    [name],
  )
  return Boolean(rows[0])
}

async function hasSchemaMigration(name) {
  const [rows] = await databaseConnection.execute(
    'SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1',
    [name],
  )
  return Boolean(rows[0])
}

async function migrateCustomerEmailVerification() {
  if (!(await hasCustomerColumn('email_verified_at'))) {
    await databaseConnection.query(
      'ALTER TABLE customers ADD COLUMN email_verified_at DATETIME NULL AFTER email',
    )
  }

  if (!(await hasCustomerColumn('pending_email'))) {
    await databaseConnection.query(
      'ALTER TABLE customers ADD COLUMN pending_email VARCHAR(254) NULL AFTER email_verified_at',
    )
  }

  if (!(await hasCustomerIndex('customers_pending_email_unique'))) {
    await databaseConnection.query(
      'ALTER TABLE customers ADD UNIQUE INDEX customers_pending_email_unique (pending_email)',
    )
  }

  if (!(await hasCustomerIndex('customers_email_verification_cleanup_index'))) {
    await databaseConnection.query(
      `ALTER TABLE customers
       ADD INDEX customers_email_verification_cleanup_index (email_verified_at, created_at)`,
    )
  }

  const migrationName = '20260918_customer_email_verification'
  if (!(await hasSchemaMigration(migrationName))) {
    await databaseConnection.beginTransaction()
    try {
      await databaseConnection.query(
        'UPDATE customers SET email_verified_at = UTC_TIMESTAMP() WHERE email_verified_at IS NULL',
      )
      await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
        migrationName,
      ])
      await databaseConnection.commit()
    } catch (error) {
      await databaseConnection.rollback()
      throw error
    }
  }
}

async function migrateLegacyAppointments() {
  if (!(await hasAppointmentColumn('active_slot'))) {
    await databaseConnection.query(
      `ALTER TABLE appointments
       ADD COLUMN active_slot BOOLEAN GENERATED ALWAYS AS (
         IF(status IN ('confirmado', 'pendente'), TRUE, NULL)
       ) STORED AFTER status`,
    )
  }

  if (!(await hasAppointmentIndex('appointments_active_start_unique'))) {
    await databaseConnection.query(
      `ALTER TABLE appointments
       ADD UNIQUE INDEX appointments_active_start_unique
         (barber_id, appointment_date, appointment_time, active_slot)`,
    )
  }

  if (await hasAppointmentIndex('appointments_barber_start_unique')) {
    await databaseConnection.query(
      'ALTER TABLE appointments DROP INDEX appointments_barber_start_unique',
    )
  }
}

async function removeLegacyCustomerLoyalty() {
  const migrationName = '20260921_remove_customer_loyalty'
  if (await hasSchemaMigration(migrationName)) return

  if (await hasCustomerColumn('loyalty_points')) {
    await databaseConnection.query('ALTER TABLE customers DROP COLUMN loyalty_points')
  }

  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

async function removeLegacyCustomerPhoto() {
  const migrationName = '20260922_remove_customer_photo'
  if (await hasSchemaMigration(migrationName)) return

  if (await hasCustomerColumn('photo_url')) {
    await databaseConnection.query('ALTER TABLE customers DROP COLUMN photo_url')
  }

  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

async function migrateStaffUserBarberAccess() {
  const migrationName = '20260922_staff_user_barber_access'
  if (await hasSchemaMigration(migrationName)) return

  if (!(await hasStaffUserIndex('staff_users_barber_id_unique'))) {
    await databaseConnection.query(
      'ALTER TABLE staff_users ADD UNIQUE INDEX staff_users_barber_id_unique (barber_id)',
    )
  }
  if (await hasStaffUserIndex('staff_users_barber_id_index')) {
    await databaseConnection.query(
      'ALTER TABLE staff_users DROP INDEX staff_users_barber_id_index',
    )
  }

  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

async function removePendingAppointmentStatus() {
  const migrationName = '20260925_remove_pending_appointment_status'
  if (await hasSchemaMigration(migrationName)) return

  await databaseConnection.query(
    "UPDATE appointments SET status = 'confirmado' WHERE status = 'pendente'",
  )
  await databaseConnection.query(
    `ALTER TABLE appointments
     MODIFY COLUMN status ENUM('confirmado', 'concluido', 'cancelado') NOT NULL DEFAULT 'confirmado',
     MODIFY COLUMN active_slot BOOLEAN GENERATED ALWAYS AS (
       IF(status = 'confirmado', TRUE, NULL)
     ) STORED`,
  )
  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

async function addAppointmentPeriodIndex() {
  const migrationName = '20260927_appointment_period_index'
  if (await hasSchemaMigration(migrationName)) return

  if (!(await hasAppointmentIndex('appointments_period_index'))) {
    await databaseConnection.query(
      `ALTER TABLE appointments
       ADD INDEX appointments_period_index (appointment_date, appointment_time, barber_id)`,
    )
  }

  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

async function addBarberProfilePhotos() {
  const migrationName = '20261004_barber_profile_photos'
  if (await hasSchemaMigration(migrationName)) return

  if (!(await hasBarberColumn('photo_data'))) {
    await databaseConnection.query(
      'ALTER TABLE barbers ADD COLUMN photo_data MEDIUMBLOB NULL AFTER photo_url',
    )
  }
  if (!(await hasBarberColumn('photo_mime'))) {
    await databaseConnection.query(
      'ALTER TABLE barbers ADD COLUMN photo_mime VARCHAR(32) NULL AFTER photo_data',
    )
  }
  if (!(await hasBarberColumn('photo_position_x'))) {
    await databaseConnection.query(
      'ALTER TABLE barbers ADD COLUMN photo_position_x TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER photo_mime',
    )
  }
  if (!(await hasBarberColumn('photo_position_y'))) {
    await databaseConnection.query(
      'ALTER TABLE barbers ADD COLUMN photo_position_y TINYINT UNSIGNED NOT NULL DEFAULT 50 AFTER photo_position_x',
    )
  }
  if (!(await hasBarberColumn('photo_revision'))) {
    await databaseConnection.query(
      'ALTER TABLE barbers ADD COLUMN photo_revision INT UNSIGNED NOT NULL DEFAULT 0 AFTER photo_position_y',
    )
  }

  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

async function addBarberContactProfile() {
  const migrationName = '20261005_barber_contact_profile'
  if (await hasSchemaMigration(migrationName)) return

  if (!(await hasBarberColumn('phone'))) {
    await databaseConnection.query(
      "ALTER TABLE barbers ADD COLUMN phone VARCHAR(11) NOT NULL DEFAULT '' AFTER name",
    )
  }

  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

async function updateDefaultBusinessLocation() {
  const migrationName = '20261005_update_default_business_location'
  if (await hasSchemaMigration(migrationName)) return

  await databaseConnection.execute(
    'UPDATE business_settings SET phone = ? WHERE id = 1 AND phone = ?',
    ['15991307316', '1140028899'],
  )
  await databaseConnection.execute(
    `UPDATE business_settings
     SET street = ?, district = ?, city = ?, state = ?, postal_code = ?,
       latitude = ?, longitude = ?, parking_info = '', transit_info = ''
     WHERE id = 1
       AND street IN (?, ?)
       AND city = ?
       AND postal_code = ?`,
    [
      'Rua Antônio Marinoni, 183',
      'Jardim Mirante dos Óvnis',
      'Votorantim',
      'SP',
      '18110420',
      -23.5527037,
      -47.452788,
      'Rua das Palmeiras, 245',
      'Antonio Marinoni, 183',
      'São Paulo',
      '01432000',
    ],
  )

  await databaseConnection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [
    migrationName,
  ])
}

try {
  await databaseConnection.query(schema)
  await migrateCustomerEmailVerification()
  await migrateLegacyAppointments()
  await removeLegacyCustomerLoyalty()
  await removeLegacyCustomerPhoto()
  await migrateStaffUserBarberAccess()
  await removePendingAppointmentStatus()
  await addAppointmentPeriodIndex()
  await addBarberProfilePhotos()
  await addBarberContactProfile()
  await updateDefaultBusinessLocation()
  console.log(`Banco ${databaseName} preparado com sucesso.`)
} finally {
  await databaseConnection.end()
}
