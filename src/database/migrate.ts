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
      { name: "promo_code", ddl: "ALTER TABLE orders ADD COLUMN promo_code TEXT" },
      { name: "original_price", ddl: "ALTER TABLE orders ADD COLUMN original_price INTEGER" },
      { name: "discount_amount", ddl: "ALTER TABLE orders ADD COLUMN discount_amount INTEGER" },
      { name: "promo_counted", ddl: "ALTER TABLE orders ADD COLUMN promo_counted INTEGER NOT NULL DEFAULT 0" },
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

  database.exec(`
    CREATE TABLE IF NOT EXISTS telegram_users (
      telegram_id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (tableExists(database, "orders")) {
    database.exec(`
      INSERT OR IGNORE INTO telegram_users (telegram_id, username)
      SELECT
        telegram_user_id,
        (
          SELECT o2.telegram_username
          FROM orders o2
          WHERE o2.telegram_user_id = o.telegram_user_id
            AND o2.telegram_username IS NOT NULL
            AND TRIM(o2.telegram_username) != ''
          ORDER BY o2.id DESC
          LIMIT 1
        )
      FROM (SELECT DISTINCT telegram_user_id FROM orders) o;
    `);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'fixed')),
      discount_value INTEGER NOT NULL,
      expires_at TEXT,
      max_uses INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT,
      telegram_user_id INTEGER NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      message_text TEXT,
      photo_file_id TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT,
      last_activity_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_ticket_number
      ON support_tickets(ticket_number);

    CREATE INDEX IF NOT EXISTS idx_support_tickets_user
      ON support_tickets(telegram_user_id);

    CREATE TABLE IF NOT EXISTS support_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      sender TEXT NOT NULL DEFAULT 'admin',
      message_text TEXT,
      photo_file_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_support_replies_ticket
      ON support_replies(ticket_id);
  `);

  if (
    tableExists(database, "support_tickets") &&
    !hasColumn(database, "support_tickets", "closed_at")
  ) {
    database.exec("ALTER TABLE support_tickets ADD COLUMN closed_at TEXT");
    logger.info("Migration: added support_tickets.closed_at");
  }

  if (
    tableExists(database, "support_tickets") &&
    !hasColumn(database, "support_tickets", "last_activity_at")
  ) {
    database.exec("ALTER TABLE support_tickets ADD COLUMN last_activity_at TEXT");
    logger.info("Migration: added support_tickets.last_activity_at");
  }

  if (tableExists(database, "support_tickets")) {
    database.exec(`
      UPDATE support_tickets
      SET last_activity_at = COALESCE(
        (
          SELECT MAX(created_at)
          FROM support_replies
          WHERE support_replies.ticket_id = support_tickets.id
        ),
        created_at
      )
      WHERE last_activity_at IS NULL OR TRIM(last_activity_at) = ''
    `);
  }

  if (
    tableExists(database, "support_replies") &&
    !hasColumn(database, "support_replies", "sender")
  ) {
    database.exec(
      "ALTER TABLE support_replies ADD COLUMN sender TEXT NOT NULL DEFAULT 'admin'"
    );
    logger.info("Migration: added support_replies.sender");
  }

  if (tableExists(database, "support_replies")) {
    database.exec(`
      UPDATE support_replies
      SET sender = 'admin'
      WHERE sender IS NULL OR TRIM(sender) = ''
    `);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS catalog_school_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS catalog_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year_id INTEGER NOT NULL,
      name_ar TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (year_id) REFERENCES catalog_school_years(id)
    );

    CREATE INDEX IF NOT EXISTS idx_catalog_subjects_year
      ON catalog_subjects(year_id);

    CREATE TABLE IF NOT EXISTS catalog_content_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '📄',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (tableExists(database, "product_content")) {
    const contentColumns: Array<{ name: string; ddl: string }> = [
      { name: "year_id", ddl: "ALTER TABLE product_content ADD COLUMN year_id INTEGER" },
      { name: "subject_id", ddl: "ALTER TABLE product_content ADD COLUMN subject_id INTEGER" },
      {
        name: "catalog_content_type_id",
        ddl: "ALTER TABLE product_content ADD COLUMN catalog_content_type_id INTEGER",
      },
      { name: "academy_url", ddl: "ALTER TABLE product_content ADD COLUMN academy_url TEXT" },
      {
        name: "is_catalog_item",
        ddl: "ALTER TABLE product_content ADD COLUMN is_catalog_item INTEGER NOT NULL DEFAULT 0",
      },
    ];

    for (const column of contentColumns) {
      if (!hasColumn(database, "product_content", column.name)) {
        database.exec(column.ddl);
        logger.info(`Migration: added product_content.${column.name}`);
      }
    }

    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_product_content_catalog
        ON product_content(year_id, subject_id, catalog_content_type_id);
    `);
  }

  seedDefaultCatalogContentTypes(database);
  seedDefaultPrimaryCatalogYearsAndSubjects(database);
}

function seedDefaultCatalogContentTypes(database: DatabaseSync): void {
  const defaults = [
    { slug: "lessons", nameAr: "الدروس", emoji: "📘", sortOrder: 1 },
    { slug: "exercises", nameAr: "التمارين", emoji: "✏️", sortOrder: 2 },
    { slug: "exams", nameAr: "الاختبارات", emoji: "📝", sortOrder: 3 },
    { slug: "games", nameAr: "الألعاب والأنشطة", emoji: "🎮", sortOrder: 4 },
    { slug: "videos", nameAr: "الفيديوهات", emoji: "🎬", sortOrder: 5 },
  ];

  const insert = database.prepare(`
    INSERT OR IGNORE INTO catalog_content_types (slug, name_ar, emoji, sort_order)
    VALUES (@slug, @nameAr, @emoji, @sortOrder)
  `);

  for (const row of defaults) {
    insert.run(row);
  }
}

const PRIMARY_SCHOOL_YEARS = [
  { nameAr: "السنة الأولى ابتدائي", sortOrder: 1 },
  { nameAr: "السنة الثانية ابتدائي", sortOrder: 2 },
  { nameAr: "السنة الثالثة ابتدائي", sortOrder: 3 },
  { nameAr: "السنة الرابعة ابتدائي", sortOrder: 4 },
  { nameAr: "السنة الخامسة ابتدائي", sortOrder: 5 },
] as const;

const PRIMARY_SCHOOL_SUBJECTS = [
  { nameAr: "اللغة العربية", sortOrder: 1 },
  { nameAr: "الرياضيات", sortOrder: 2 },
  { nameAr: "اللغة الفرنسية", sortOrder: 3 },
  { nameAr: "التربية العلمية", sortOrder: 4 },
  { nameAr: "التربية الإسلامية", sortOrder: 5 },
  { nameAr: "التربية المدنية", sortOrder: 6 },
  { nameAr: "التاريخ والجغرافيا", sortOrder: 7 },
] as const;

function seedDefaultPrimaryCatalogYearsAndSubjects(
  database: DatabaseSync
): void {
  if (!tableExists(database, "catalog_school_years")) {
    return;
  }
  if (!tableExists(database, "catalog_subjects")) {
    return;
  }

  const findYearId = database.prepare(`
    SELECT id FROM catalog_school_years WHERE name_ar = ? LIMIT 1
  `);
  const insertYear = database.prepare(`
    INSERT INTO catalog_school_years (name_ar, sort_order)
    VALUES (?, ?)
  `);
  const findSubjectId = database.prepare(`
    SELECT id FROM catalog_subjects WHERE year_id = ? AND name_ar = ? LIMIT 1
  `);
  const insertSubject = database.prepare(`
    INSERT INTO catalog_subjects (year_id, name_ar, sort_order)
    VALUES (?, ?, ?)
  `);

  for (const year of PRIMARY_SCHOOL_YEARS) {
    const existingYear = findYearId.get(year.nameAr) as { id: number } | undefined;
    const yearId =
      existingYear?.id ??
      Number(
        insertYear.run(year.nameAr, year.sortOrder).lastInsertRowid
      );

    for (const subject of PRIMARY_SCHOOL_SUBJECTS) {
      const existingSubject = findSubjectId.get(yearId, subject.nameAr) as
        | { id: number }
        | undefined;
      if (existingSubject) {
        continue;
      }
      insertSubject.run(yearId, subject.nameAr, subject.sortOrder);
    }
  }
}
