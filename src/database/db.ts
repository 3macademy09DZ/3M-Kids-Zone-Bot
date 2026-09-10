import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { runMigrations } from "./migrate";
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
      order_number TEXT,
      telegram_user_id INTEGER NOT NULL,
      telegram_username TEXT,
      product_id TEXT NOT NULL,
      content_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      invite_link TEXT,
      invite_link_name TEXT,
      notes TEXT,
      payment_method TEXT,
      payment_proof_file_id TEXT,
      payment_proof_media_kind TEXT,
      payment_submitted_at TEXT,
      payment_reviewed_at TEXT,
      purchase_price INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_orders_telegram_user_id
      ON orders(telegram_user_id);

    CREATE INDEX IF NOT EXISTS idx_orders_status
      ON orders(status);

    CREATE TABLE IF NOT EXISTS product_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      content_type TEXT NOT NULL CHECK(content_type IN ('video', 'game', 'file')),
      title_ar TEXT NOT NULL,
      description_ar TEXT,
      telegram_file_id TEXT NOT NULL,
      telegram_file_unique_id TEXT,
      media_kind TEXT NOT NULL CHECK(media_kind IN ('video', 'document', 'photo', 'animation')),
      file_name TEXT,
      mime_type TEXT,
      price INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_product_content_product_id
      ON product_content(product_id);

    CREATE INDEX IF NOT EXISTS idx_product_content_type
      ON product_content(product_id, content_type);

    CREATE TABLE IF NOT EXISTS telegram_users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  runMigrations(database);
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
