CREATE TABLE IF NOT EXISTS schema_migrations (
  name VARCHAR(100) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(11) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_verified_at DATETIME NULL,
  pending_email VARCHAR(254) NULL,
  password_hash VARCHAR(255) NOT NULL,
  birth_date DATE NULL,
  preferred_cut VARCHAR(100) NOT NULL DEFAULT '',
  beard_style VARCHAR(100) NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_opted_in_at DATETIME NULL,
  whatsapp_opted_out_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY customers_email_unique (email),
  UNIQUE KEY customers_pending_email_unique (pending_email),
  KEY customers_email_verification_cleanup_index (email_verified_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS services (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  price DECIMAL(10, 2) UNSIGNED NOT NULL,
  category ENUM('cortes', 'barba', 'combos', 'acabamentos') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS barbers (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(11) NOT NULL DEFAULT '',
  specialty VARCHAR(160) NOT NULL,
  rating DECIMAL(2, 1) UNSIGNED NOT NULL DEFAULT 0,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  bio VARCHAR(500) NOT NULL,
  photo_url VARCHAR(512) NOT NULL,
  photo_data MEDIUMBLOB NULL,
  photo_mime VARCHAR(32) NULL,
  photo_position_x TINYINT UNSIGNED NOT NULL DEFAULT 50,
  photo_position_y TINYINT UNSIGNED NOT NULL DEFAULT 50,
  photo_revision INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS staff_users (
  id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'barber') NOT NULL DEFAULT 'barber',
  barber_id VARCHAR(64) NULL,
  notification_phone VARCHAR(11) NOT NULL DEFAULT '',
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_opted_in_at DATETIME NULL,
  whatsapp_opted_out_at DATETIME NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY staff_users_email_unique (email),
  UNIQUE KEY staff_users_barber_id_unique (barber_id),
  CONSTRAINT staff_users_barber_id_fk
    FOREIGN KEY (barber_id) REFERENCES barbers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash CHAR(64) NOT NULL,
  staff_user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY staff_sessions_user_id_index (staff_user_id),
  KEY staff_sessions_expires_at_index (expires_at),
  CONSTRAINT staff_sessions_user_id_fk
    FOREIGN KEY (staff_user_id) REFERENCES staff_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS business_settings (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  name VARCHAR(100) NOT NULL,
  street VARCHAR(160) NOT NULL,
  district VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state CHAR(2) NOT NULL,
  postal_code CHAR(8) NOT NULL,
  phone VARCHAR(11) NOT NULL,
  email VARCHAR(254) NOT NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  parking_info VARCHAR(255) NOT NULL DEFAULT '',
  transit_info VARCHAR(255) NOT NULL DEFAULT '',
  cnpj VARCHAR(14) NOT NULL DEFAULT '',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT business_settings_single_row_check CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS business_hours (
  weekday TINYINT UNSIGNED NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT FALSE,
  open_time TIME NULL,
  close_time TIME NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (weekday),
  CONSTRAINT business_hours_weekday_check CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT business_hours_range_check CHECK (
    (is_open = FALSE AND open_time IS NULL AND close_time IS NULL)
    OR (is_open = TRUE AND open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY sessions_customer_id_index (customer_id),
  KEY sessions_expires_at_index (expires_at),
  CONSTRAINT sessions_customer_id_fk
    FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash CHAR(64) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY password_reset_customer_id_index (customer_id),
  KEY password_reset_expires_at_index (expires_at),
  CONSTRAINT password_reset_customer_id_fk
    FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_hash CHAR(64) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  email VARCHAR(254) NOT NULL,
  purpose ENUM('registration', 'email_change') NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  UNIQUE KEY email_verification_customer_purpose_unique (customer_id, purpose),
  KEY email_verification_expiry_index (expires_at),
  CONSTRAINT email_verification_customer_id_fk
    FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS security_rate_limits (
  bucket_key CHAR(64) NOT NULL,
  action VARCHAR(40) NOT NULL,
  hit_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  window_started_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (bucket_key),
  KEY security_rate_limits_expiry_index (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  service_id VARCHAR(64) NOT NULL,
  barber_id VARCHAR(64) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status ENUM('confirmado', 'concluido', 'cancelado') NOT NULL DEFAULT 'confirmado',
  active_slot BOOLEAN GENERATED ALWAYS AS (
    IF(status = 'confirmado', TRUE, NULL)
  ) STORED,
  price DECIMAL(10, 2) UNSIGNED NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  notification_revision INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY appointments_active_start_unique (
    barber_id,
    appointment_date,
    appointment_time,
    active_slot
  ),
  KEY appointments_period_index (appointment_date, appointment_time, barber_id),
  KEY appointments_customer_schedule_index (customer_id, appointment_date, appointment_time),
  CONSTRAINT appointments_customer_id_fk
    FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT appointments_service_id_fk
    FOREIGN KEY (service_id) REFERENCES services (id),
  CONSTRAINT appointments_barber_id_fk
    FOREIGN KEY (barber_id) REFERENCES barbers (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id CHAR(36) NOT NULL,
  barber_id VARCHAR(64) NULL,
  block_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  reason VARCHAR(160) NOT NULL,
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY schedule_blocks_date_index (block_date, start_time),
  KEY schedule_blocks_barber_date_index (barber_id, block_date),
  KEY schedule_blocks_created_by_index (created_by),
  CONSTRAINT schedule_blocks_barber_id_fk
    FOREIGN KEY (barber_id) REFERENCES barbers (id) ON DELETE CASCADE,
  CONSTRAINT schedule_blocks_created_by_fk
    FOREIGN KEY (created_by) REFERENCES staff_users (id) ON DELETE RESTRICT,
  CONSTRAINT schedule_blocks_time_range_check CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS email_notifications (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  appointment_id CHAR(36) NULL,
  notification_type ENUM(
    'appointment_created',
    'appointment_rescheduled',
    'appointment_cancelled',
    'appointment_reminder'
  ) NOT NULL,
  recipient_email VARCHAR(254) NOT NULL,
  recipient_name VARCHAR(80) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  text_body TEXT NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  status ENUM('pending', 'processing', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  scheduled_for DATETIME NOT NULL,
  sent_at DATETIME NULL,
  last_error VARCHAR(500) NULL,
  dedupe_key VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY email_notifications_dedupe_unique (dedupe_key),
  KEY email_notifications_pending_index (status, scheduled_for, attempt_count),
  KEY email_notifications_customer_index (customer_id, created_at),
  KEY email_notifications_appointment_index (appointment_id),
  CONSTRAINT email_notifications_customer_id_fk
    FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT email_notifications_appointment_id_fk
    FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id CHAR(36) NOT NULL,
  appointment_id CHAR(36) NULL,
  appointment_revision INT UNSIGNED NOT NULL,
  event ENUM(
    'appointment_created',
    'appointment_rescheduled',
    'appointment_cancelled',
    'reminder_24h',
    'reminder_2h'
  ) NOT NULL,
  audience ENUM('customer', 'barber', 'admin') NOT NULL,
  recipient_kind ENUM('customer', 'staff') NOT NULL,
  recipient_id CHAR(36) NOT NULL,
  target_barber_id VARCHAR(64) NULL,
  recipient_phone VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(80) NOT NULL,
  details_snapshot JSON NOT NULL,
  status ENUM(
    'pending',
    'processing',
    'previewed',
    'accepted',
    'sent',
    'delivered',
    'read',
    'failed',
    'skipped',
    'superseded'
  ) NOT NULL DEFAULT 'pending',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  scheduled_for DATETIME NOT NULL,
  next_attempt_at DATETIME NOT NULL,
  locked_at DATETIME NULL,
  provider_message_id VARCHAR(512) NULL,
  provider_status_at DATETIME NULL,
  last_error VARCHAR(500) NULL,
  dedupe_key VARCHAR(191) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY whatsapp_notifications_dedupe_unique (dedupe_key),
  UNIQUE KEY whatsapp_notifications_provider_message_unique (provider_message_id),
  KEY whatsapp_notifications_dispatch_index
    (status, scheduled_for, next_attempt_at, attempts),
  KEY whatsapp_notifications_appointment_index
    (appointment_id, appointment_revision, event),
  KEY whatsapp_notifications_recipient_index
    (recipient_kind, recipient_id, created_at),
  KEY whatsapp_notifications_target_barber_index (target_barber_id),
  CONSTRAINT whatsapp_notifications_appointment_id_fk
    FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE SET NULL,
  CONSTRAINT whatsapp_notifications_target_barber_id_fk
    FOREIGN KEY (target_barber_id) REFERENCES barbers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS whatsapp_webhook_status_events (
  event_key CHAR(64) NOT NULL,
  provider_message_id VARCHAR(512) NOT NULL,
  status ENUM('sent', 'delivered', 'read', 'failed') NOT NULL,
  provider_status_at DATETIME NOT NULL,
  last_error VARCHAR(500) NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at DATETIME NULL,
  PRIMARY KEY (event_key),
  KEY whatsapp_webhook_status_events_message_index
    (provider_message_id, applied_at, provider_status_at),
  KEY whatsapp_webhook_status_events_pending_index (applied_at, provider_status_at),
  KEY whatsapp_webhook_status_events_cleanup_index (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO services (id, name, description, duration_minutes, price, category)
VALUES
  ('corte', 'Corte', 'Degradê, social ou corte tradicional.', 45, 40.00, 'cortes'),
  ('barba', 'Barba', 'Modelagem completa com navalha e toalha quente.', 30, 35.00, 'barba'),
  ('corte-barba', 'Corte + Barba', 'O combo completo para um visual impecável.', 75, 65.00, 'combos'),
  ('sobrancelha', 'Sobrancelha', 'Alinhamento e limpeza com navalha.', 15, 15.00, 'acabamentos'),
  ('acabamento', 'Acabamento', 'Retoque de contorno e nuca entre cortes.', 20, 20.00, 'acabamentos'),
  ('corte-infantil', 'Corte Infantil', 'Corte especial para os pequenos, com paciência e cuidado.', 40, 35.00, 'cortes');

INSERT IGNORE INTO barbers (id, name, specialty, rating, review_count, bio, photo_url)
VALUES
  (
    'guilherme',
    'Matheus Guilherme',
    'Especialista em degradê e corte masculino',
    4.9,
    218,
    'Fundador da Gui Santos Barbearia, com mais de 12 anos de experiência em cortes masculinos de alto padrão.',
    '/images/WhatsApp Image 2026-08-26 at 13.09.49.jpeg'
  ),
  (
    'vitor',
    'Vitor',
    'Especialista em degradê e corte masculino',
    4.9,
    134,
    'Especialista em degradê e corte masculino, com atenção aos detalhes para um resultado preciso.',
    '/images/b123ae60-0e4a-479b-aba0-a533ed6f4a98.jpg'
  );

INSERT IGNORE INTO business_settings
  (id, name, street, district, city, state, postal_code, phone, email, latitude, longitude, parking_info, transit_info, cnpj)
VALUES
  (
    1,
    'Gui Santos Barbearia',
    'Rua Antônio Marinoni, 183',
    'Jardim Mirante dos Óvnis',
    'Votorantim',
    'SP',
    '18110420',
    '15991307316',
    'contato@guisantosbarbearia.com.br',
    -23.5527037,
    -47.4527880,
    '',
    '',
    '12345678000190'
  );

INSERT IGNORE INTO business_hours (weekday, is_open, open_time, close_time)
VALUES
  (0, FALSE, NULL, NULL),
  (1, FALSE, NULL, NULL),
  (2, TRUE, '09:00:00', '20:00:00'),
  (3, TRUE, '09:00:00', '20:00:00'),
  (4, TRUE, '09:00:00', '20:00:00'),
  (5, TRUE, '09:00:00', '20:00:00'),
  (6, TRUE, '09:00:00', '18:00:00');
