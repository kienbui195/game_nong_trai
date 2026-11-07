import { createPool, Pool } from 'mysql2/promise';
import { config } from './config';

export const POOL = 'DB_POOL';

export function makePool(): Pool {
  return createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 8,
    charset: 'utf8mb4',
    // JSON trả về dạng chuỗi rồi tự parse để không phụ thuộc phiên bản driver
    typeCast: (field, next) => (field.type === 'JSON' ? field.string('utf8') : next()),
  });
}

export async function migrate(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(40) NOT NULL,
      display_name VARCHAR(30) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS farms (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      state JSON NOT NULL,
      version INT UNSIGNED NOT NULL DEFAULT 1,
      sim_at BIGINT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_farms_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS questions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      difficulty TINYINT UNSIGNED NOT NULL,
      text VARCHAR(500) NOT NULL,
      option_a VARCHAR(200) NOT NULL,
      option_b VARCHAR(200) NOT NULL,
      option_c VARCHAR(200) NOT NULL,
      option_d VARCHAR(200) NOT NULL,
      correct CHAR(1) NOT NULL,
      text_hash CHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_questions_text_hash (text_hash),
      KEY idx_questions_difficulty (difficulty)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
