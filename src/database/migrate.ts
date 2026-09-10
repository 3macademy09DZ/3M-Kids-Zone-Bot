import type { DatabaseSync } from "node:sqlite";
import { logger } from "../utils/logger";

interface TableInfoRow {
  name: string;
}

function tableExists(database: DatabaseSync, table: string): boolean {
  const row = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(table) as { name: string } | undefined;
  return Boolean(row?.name);
}

function hasColumn(
  database: DatabaseSync,
  table: string,
  column: string
): boolean {
  if (!tableExists(database, table)) {
    return false;
  }

  const rows = database
    .prepare(`PRAGMA table_info(${table})`)
    .all() as unknown as TableInfoRow[];
  return rows.some((row) => row.name === column);
}

/**
 * Additive, non-destructive migrations.
 * Existing tables and rows are never dropped.
 */
export function runMigrations(database: DatabaseSync): void {
  if (tableExists(database, "orders") && !hasColumn(database, "orders", "content_id")) {
    database.exec("ALTER TABLE orders ADD COLUMN content_id INTEGER");
    logger.info("Migration: added orders.content_id");
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_content_id
      ON orders(content_id);

    CREATE TABLE IF NOT EXISTS video_entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER NOT NULL,
      content_id INTEGER NOT NULL,
      order_id INTEGER,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (telegram_user_id, content_id)
    );

    CREATE INDEX IF NOT EXISTS idx_video_entitlements_user
      ON video_entitlements(telegram_user_id);

    CREATE INDEX IF NOT EXISTS idx_video_entitlements_content
      ON video_entitlements(content_id);
  `);

  if (
    tableExists(database, "product_content") &&
    !hasColumn(database, "product_content", "price")
  ) {
    database.exec("ALTER TABLE product_content ADD COLUMN price INTEGER");
    logger.info("Migration: added product_content.price");
  }

  if (tableExists(database, "orders")) {
    const orderColumns: Array<{ name: string; ddl: string }> = [
      { name: "payment_method", ddl: "ALTER TABLE orders ADD COLUMN payment_method TEXT" },
      { name: "payment_proof_file_id", ddl: "ALTER TABLE orders ADD COLUMN payment_proof_file_id TEXT" },
      {
        name: "payment_proof_media_kind",
        ddl: "ALTER TABLE orders ADD COLUMN payment_proof_media_kind TEXT",
      },
      { name: "payment_submitted_at", ddl: "ALTER TABLE orders ADD COLUMN payment_submitted_at TEXT" },
      { name: "payment_reviewed_at", ddl: "ALTER TABLE orders ADD COLUMN payment_reviewed_at TEXT" },
      { name: "order_number", ddl: "ALTER TABLE orders ADD COLUMN order_number TEXT" },
      { name: "purchase_price", ddl: "ALTER TABLE orders ADD COLUMN purchase_price INTEGER" },
    ];

    for (const column of orderColumns) {
      if (!hasColumn(database, "orders", column.name)) {
        database.exec(column.ddl);
        logger.info(`Migration: added orders.${column.name}`);
      }
    }

    database.exec(`
      UPDATE orders
      SET order_number = printf('3M-%06d', id)
      WHERE order_number IS NULL OR TRIM(order_number) = '';
    `);

    database.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number
        ON orders(order_number);
    `);
  }
}
