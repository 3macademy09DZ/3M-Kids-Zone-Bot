import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type {
  ContentType,
  CreateContentInput,
  ProductContentItem,
} from "./contentTypes";

interface ContentRow {
  id: number;
  product_id: string;
  content_type: string;
  title_ar: string;
  description_ar: string | null;
  telegram_file_id: string;
  telegram_file_unique_id: string | null;
  media_kind: string;
  file_name: string | null;
  mime_type: string | null;
  sort_order: number;
  created_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): ContentRow | undefined {
  return stmt.get(...params) as unknown as ContentRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): ContentRow[] {
  return stmt.all(...params) as unknown as ContentRow[];
}

function mapRow(row: ContentRow): ProductContentItem {
  return {
    id: row.id,
    productId: row.product_id,
    contentType: row.content_type as ContentType,
    titleAr: row.title_ar,
    descriptionAr: row.description_ar,
    telegramFileId: row.telegram_file_id,
    telegramFileUniqueId: row.telegram_file_unique_id,
    mediaKind: row.media_kind as ProductContentItem["mediaKind"],
    fileName: row.file_name,
    mimeType: row.mime_type,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function createContentItem(input: CreateContentInput): ProductContentItem {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO product_content (
      product_id, content_type, title_ar, description_ar,
      telegram_file_id, telegram_file_unique_id, media_kind,
      file_name, mime_type, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.productId,
    input.contentType,
    input.titleAr,
    input.descriptionAr ?? null,
    input.telegramFileId,
    input.telegramFileUniqueId ?? null,
    input.mediaKind,
    input.fileName ?? null,
    input.mimeType ?? null,
    input.sortOrder ?? 0
  );

  const item = getContentItemById(Number(result.lastInsertRowid));
  if (!item) {
    throw new Error("Failed to retrieve content item after creation");
  }
  return item;
}

export function getContentItemById(id: number): ProductContentItem | null {
  const db = getDatabase();
  const row = getRow(db.prepare("SELECT * FROM product_content WHERE id = ?"), id);
  return row ? mapRow(row) : null;
}

export function getContentItemsByProductId(
  productId: string
): ProductContentItem[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM product_content
      WHERE product_id = ?
      ORDER BY content_type ASC, sort_order ASC, id ASC
    `),
    productId
  );
  return rows.map(mapRow);
}

export function getContentItemsByProductAndType(
  productId: string,
  contentType: ContentType
): ProductContentItem[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM product_content
      WHERE product_id = ? AND content_type = ?
      ORDER BY sort_order ASC, id ASC
    `),
    productId,
    contentType
  );
  return rows.map(mapRow);
}

export function getEntitledContentItemsForUser(
  telegramUserId: number
): ProductContentItem[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT pc.*
      FROM product_content pc
      INNER JOIN video_entitlements ve ON ve.content_id = pc.id
      WHERE ve.telegram_user_id = ?
      ORDER BY pc.product_id ASC, pc.sort_order ASC, pc.id ASC
    `),
    telegramUserId
  );
  return rows.map(mapRow);
}

export function deleteContentItem(id: number): boolean {
  const db = getDatabase();
  const result = db.prepare("DELETE FROM product_content WHERE id = ?").run(id);
  return result.changes > 0;
}
