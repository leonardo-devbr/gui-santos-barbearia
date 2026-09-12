CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL,
  name VARCHAR(80) NOT NULL,
  phone VARCHAR(11) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  birth_date DATE NULL,
  photo_url VARCHAR(512) NOT NULL DEFAULT '/placeholder-user.jpg',
  preferred_cut VARCHAR(100) NOT NULL DEFAULT '',
  beard_style VARCHAR(100) NOT NULL DEFAULT '',
  notes VARCHAR(500) NOT NULL DEFAULT '',
  loyalty_points INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY customers_email_unique (email)
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
  specialty VARCHAR(160) NOT NULL,
  rating DECIMAL(2, 1) UNSIGNED NOT NULL DEFAULT 0,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  bio VARCHAR(500) NOT NULL,
  photo_url VARCHAR(512) NOT NULL,
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
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY staff_users_email_unique (email),
  KEY staff_users_barber_id_index (barber_id),
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

CREATE TABLE IF NOT EXISTS appointments (
  id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  service_id VARCHAR(64) NOT NULL,
  barber_id VARCHAR(64) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status ENUM('confirmado', 'pendente', 'concluido', 'cancelado') NOT NULL DEFAULT 'confirmado',
  active_slot BOOLEAN GENERATED ALWAYS AS (
    IF(status IN ('confirmado', 'pendente'), TRUE, NULL)
  ) STORED,
  price DECIMAL(10, 2) UNSIGNED NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY appointments_active_start_unique (
    barber_id,
    appointment_date,
    appointment_time,
    active_slot
  ),
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

INSERT INTO services (id, name, description, duration_minutes, price, category)
VALUES
  ('corte', 'Corte', 'Degradê, social ou corte tradicional.', 45, 40.00, 'cortes'),
  ('barba', 'Barba', 'Modelagem completa com navalha e toalha quente.', 30, 35.00, 'barba'),
  ('corte-barba', 'Corte + Barba', 'O combo completo para um visual impecável.', 75, 65.00, 'combos'),
  ('sobrancelha', 'Sobrancelha', 'Alinhamento e limpeza com navalha.', 15, 15.00, 'acabamentos'),
  ('acabamento', 'Acabamento', 'Retoque de contorno e nuca entre cortes.', 20, 20.00, 'acabamentos'),
  ('corte-infantil', 'Corte Infantil', 'Corte especial para os pequenos, com paciência e cuidado.', 40, 35.00, 'cortes')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  duration_minutes = VALUES(duration_minutes),
  price = VALUES(price),
  category = VALUES(category),
  is_active = TRUE;

INSERT INTO barbers (id, name, specialty, rating, review_count, bio, photo_url)
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
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  specialty = VALUES(specialty),
  rating = VALUES(rating),
  review_count = VALUES(review_count),
  bio = VALUES(bio),
  photo_url = VALUES(photo_url),
  is_active = TRUE;

INSERT IGNORE INTO business_settings
  (id, name, street, district, city, state, postal_code, phone, email, latitude, longitude, parking_info, transit_info, cnpj)
VALUES
  (
    1,
    'Gui Santos Barbearia',
    'Rua das Palmeiras, 245',
    'Jardim América',
    'São Paulo',
    'SP',
    '01432000',
    '1140028899',
    'contato@guisantosbarbearia.com.br',
    -23.5638000,
    -46.6558000,
    'Estacionamento conveniado a 50m, na Rua Aurora.',
    'Estação Jardim América a 5 minutos a pé.',
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
