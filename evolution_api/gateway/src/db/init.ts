/**
 * Database initialization and migrations
 * Uses MariaDB (shared with Evolution API)
 */

import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface DatabasePool {
  pool: Pool;
  query: <T extends RowDataPacket[] | ResultSetHeader>(sql: string, params?: any[]) => Promise<T>;
  getOne: <T>(sql: string, params?: any[]) => Promise<T | null>;
  getAll: <T>(sql: string, params?: any[]) => Promise<T[]>;
  run: (sql: string, params?: any[]) => Promise<ResultSetHeader>;
  transaction: <T>(fn: (conn: PoolConnection) => Promise<T>) => Promise<T>;
}

export interface DBConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export async function initDatabase(config: DBConfig): Promise<DatabasePool> {
  // Create connection pool
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  // Test connection
  try {
    const conn = await pool.getConnection();
    console.log(`[DB] Connected to MariaDB at ${config.host}:${config.port}/${config.database}`);
    conn.release();
  } catch (err: any) {
    console.error('[DB] Failed to connect to MariaDB:', err.message);
    throw err;
  }

  // Run migrations
  await runMigrations(pool);

  // Create wrapper with helper methods
  const db: DatabasePool = {
    pool,
    
    async query<T extends RowDataPacket[] | ResultSetHeader>(sql: string, params: any[] = []): Promise<T> {
      const [result] = await pool.execute<T>(sql, params);
      return result;
    },
    
    async getOne<T>(sql: string, params: any[] = []): Promise<T | null> {
      const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
      return (rows[0] as T) || null;
    },
    
    async getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
      const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
      return rows as T[];
    },
    
    async run(sql: string, params: any[] = []): Promise<ResultSetHeader> {
      const [result] = await pool.execute<ResultSetHeader>(sql, params);
      return result;
    },
    
    async transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },
  };

  console.log('[DB] Database initialized');
  return db;
}

async function runMigrations(pool: Pool): Promise<void> {
  // Create migrations table if not exists
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS gateway_migrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrations: Array<{ name: string; statements: string[] }> = [
    {
      name: '001_create_chats',
      statements: [
        `CREATE TABLE IF NOT EXISTS wa_chat (
          id VARCHAR(255) PRIMARY KEY,
          type ENUM('group', 'direct') NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(50),
          enabled TINYINT(1) DEFAULT 1,
          last_message_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_wa_chat_enabled (enabled),
          INDEX idx_wa_chat_type (type),
          INDEX idx_wa_chat_phone (phone_number)
        )`,
      ],
    },
    {
      name: '002_create_messages',
      statements: [
        `CREATE TABLE IF NOT EXISTS wa_message (
          id INT PRIMARY KEY AUTO_INCREMENT,
          provider_message_id VARCHAR(255) UNIQUE,
          chat_id VARCHAR(255) NOT NULL,
          sender_id VARCHAR(255),
          sender_name VARCHAR(255),
          text TEXT,
          message_type VARCHAR(50) DEFAULT 'text',
          raw_payload JSON,
          received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed TINYINT(1) DEFAULT 0,
          INDEX idx_wa_message_chat (chat_id),
          INDEX idx_wa_message_sender (sender_id),
          INDEX idx_wa_message_received (received_at),
          INDEX idx_wa_message_processed (processed)
        )`,
      ],
    },
    {
      name: '003_create_ruleset',
      statements: [
        `CREATE TABLE IF NOT EXISTS wa_ruleset (
          id INT PRIMARY KEY,
          yaml_text TEXT NOT NULL,
          parsed_json JSON,
          version INT DEFAULT 1,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
        `INSERT IGNORE INTO wa_ruleset (id, yaml_text, parsed_json, version)
         VALUES (1, 'version: 1\\nrules: []', '{"version":1,"rules":[]}', 1)`,
      ],
    },
    {
      name: '004_create_rule_fires',
      statements: [
        `CREATE TABLE IF NOT EXISTS wa_rule_fire (
          id INT PRIMARY KEY AUTO_INCREMENT,
          rule_id VARCHAR(255) NOT NULL,
          rule_name VARCHAR(255),
          message_id INT,
          chat_id VARCHAR(255),
          sender_id VARCHAR(255),
          matched_text TEXT,
          actions_executed JSON,
          success TINYINT(1) DEFAULT 1,
          error_message TEXT,
          fired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_rule_fire_rule (rule_id),
          INDEX idx_rule_fire_fired (fired_at),
          INDEX idx_rule_fire_success (success)
        )`,
      ],
    },
    {
      name: '005_create_cooldowns',
      statements: [
        `CREATE TABLE IF NOT EXISTS wa_cooldown (
          id INT PRIMARY KEY AUTO_INCREMENT,
          rule_id VARCHAR(255) NOT NULL,
          scope_key VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          UNIQUE KEY uk_cooldown (rule_id, scope_key),
          INDEX idx_cooldown_expires (expires_at)
        )`,
      ],
    },
    {
      name: '006_create_settings',
      statements: [
        `CREATE TABLE IF NOT EXISTS gateway_settings (
          \`key\` VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,
      ],
    },
  ];

  // Get applied migrations
  const [rows] = await pool.execute<RowDataPacket[]>('SELECT name FROM gateway_migrations');
  const applied = new Set(rows.map((r: any) => r.name));

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      console.log(`[DB] Running migration: ${migration.name}`);
      for (const statement of migration.statements) {
        try {
          await pool.execute(statement);
        } catch (err: any) {
          // Ignore "table already exists" errors for idempotency
          if (!err.message.includes('already exists')) {
            throw err;
          }
        }
      }
      await pool.execute('INSERT INTO gateway_migrations (name) VALUES (?)', [migration.name]);
    }
  }
}

// Helper types for database rows
export interface DBChat {
  id: string;
  type: 'group' | 'direct';
  name: string;
  phone_number: string | null;
  enabled: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBMessage {
  id: number;
  provider_message_id: string | null;
  chat_id: string;
  sender_id: string | null;
  sender_name: string | null;
  text: string | null;
  message_type: string;
  raw_payload: string | null;
  received_at: string;
  processed: number;
}

export interface DBRuleFire {
  id: number;
  rule_id: string;
  rule_name: string | null;
  message_id: number | null;
  chat_id: string | null;
  sender_id: string | null;
  matched_text: string | null;
  actions_executed: string | null;
  success: number;
  error_message: string | null;
  fired_at: string;
}
