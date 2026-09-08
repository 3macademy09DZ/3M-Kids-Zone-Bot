import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "orders.db");

let db: DatabaseSync | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function initSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER NOT NULL,
      telegram_username TEXT,
      product_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      invite_link TEXT,
      invite_link_name TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_telegram_user_id
      ON orders(telegram_user_id);

    CREATE INDEX IF NOT EXISTS idx_orders_status
      ON orders(status);
  `);
}

export function getDatabase(): DatabaseSync {
  if (!db) {
    ensureDataDir();
    db = new DatabaseSync(DB_PATH);
    initSchema(db);
    logger.info("SQLite database initialized");
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info("SQLite database connection closed");
  }
}
