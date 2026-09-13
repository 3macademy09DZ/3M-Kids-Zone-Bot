import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { ProductContentItem } from "./contentTypes";
import { normalizePrice } from "../utils/price";
import { getCatalogContentTypeById } from "./catalogContentTypes";
import { getCatalogSubjectById } from "./catalogSubjects";
import { getSchoolYearById } from "./catalogYears";

/** Legacy placeholder for required NOT NULL columns on old schema rows. */
export const LEGACY_CATALOG_PRODUCT_ID = "catalog-hierarchy";

interface ContentRow {
  id: number;
  product_id: string;
  content_type: string;
  title_ar: string;
  description_ar: string | null;
  telegram_file_id: string | null;
  telegram_file_unique_id: string | null;
  media_kind: string;
  file_name: string | null;
  mime_type: string | null;
  price: number | null;
  sort_order: number;
  created_at: string;
  year_id: number | null;
  subject_id: number | null;
  catalog_content_type_id: number | null;
  academy_url: string | null;
  is_catalog_item: number | null;
}

export interface CreateCatalogItemInput {
  yearId: number;
  subjectId: number;
  catalogContentTypeId: number;
  titleAr: string;
  price: number;
  academyUrl?: string | null;
  descriptionAr?: string | null;
  sortOrder?: number;
}

export interface CatalogItemContext {
  yearName: string;
  subjectName: string;
  contentTypeName: string;
  contentTypeEmoji: string;
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
    contentType: row.content_type as ProductContentItem["contentType"],
    titleAr: row.title_ar,
    descriptionAr: row.description_ar,
    telegramFileId: row.telegram_file_id,
    telegramFileUniqueId: row.telegram_file_unique_id,
    mediaKind: row.media_kind as ProductContentItem["mediaKind"],
    fileName: row.file_name,
    mimeType: row.mime_type,
    price: normalizePrice(row.price),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    yearId: row.year_id,
    subjectId: row.subject_id,
    catalogContentTypeId: row.catalog_content_type_id,
    academyUrl: row.academy_url,
    isCatalogItem: row.is_catalog_item === 1,
  };
}

const CATALOG_WHERE = `
  is_catalog_item = 1
  AND year_id IS NOT NULL
  AND subject_id IS NOT NULL
  AND catalog_content_type_id IS NOT NULL
`;

export function createCatalogItem(input: CreateCatalogItemInput): ProductContentItem {
  const db = getDatabase();
  const result = db
    .prepare(`
      INSERT INTO product_content (
        product_id, content_type, title_ar, description_ar,
        telegram_file_id, telegram_file_unique_id, media_kind,
        file_name, mime_type, price, sort_order,
        year_id, subject_id, catalog_content_type_id, academy_url, is_catalog_item
      ) VALUES (?, 'file', ?, ?, '', NULL, 'document', NULL, NULL, ?, ?, ?, ?, ?, ?, 1)
    `)
    .run(
      LEGACY_CATALOG_PRODUCT_ID,
      input.titleAr,
      input.descriptionAr ?? null,
      input.price,
      input.sortOrder ?? 0,
      input.yearId,
      input.subjectId,
      input.catalogContentTypeId,
      input.academyUrl ?? null
    );

  const item = getCatalogItemById(Number(result.lastInsertRowid));
  if (!item) throw new Error("Failed to retrieve catalog item after creation");
  return item;
}

export function getCatalogItemById(id: number): ProductContentItem | null {
  const db = getDatabase();
  const row = getRow(
    db.prepare(`SELECT * FROM product_content WHERE id = ? AND ${CATALOG_WHERE}`),
    id
  );
  return row ? mapRow(row) : null;
}

export function getCatalogItemByIdAny(id: number): ProductContentItem | null {
  const db = getDatabase();
  const row = getRow(db.prepare("SELECT * FROM product_content WHERE id = ?"), id);
  return row ? mapRow(row) : null;
}

export function getCatalogItemsByHierarchy(
  yearId: number,
  subjectId: number,
  catalogContentTypeId: number
): ProductContentItem[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM product_content
      WHERE ${CATALOG_WHERE}
        AND year_id = ?
        AND subject_id = ?
        AND catalog_content_type_id = ?
      ORDER BY sort_order ASC, id ASC
    `),
    yearId,
    subjectId,
    catalogContentTypeId
  );
  return rows.map(mapRow);
}

export function getCatalogYearsWithItems(): number[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT DISTINCT year_id AS id FROM product_content
      WHERE ${CATALOG_WHERE}
      ORDER BY year_id ASC
    `)
  ) as { id: number }[];
  return rows.map((r) => r.id);
}

export function getCatalogSubjectsWithItems(yearId: number): number[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT DISTINCT subject_id AS id FROM product_content
      WHERE ${CATALOG_WHERE} AND year_id = ?
      ORDER BY subject_id ASC
    `),
    yearId
  ) as { id: number }[];
  return rows.map((r) => r.id);
}

export function getCatalogTypesWithItems(
  yearId: number,
  subjectId: number
): number[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT DISTINCT catalog_content_type_id AS id FROM product_content
      WHERE ${CATALOG_WHERE} AND year_id = ? AND subject_id = ?
      ORDER BY catalog_content_type_id ASC
    `),
    yearId,
    subjectId
  ) as { id: number }[];
  return rows.map((r) => r.id);
}

export function updateCatalogItemTitle(
  id: number,
  titleAr: string
): ProductContentItem | null {
  const db = getDatabase();
  db.prepare("UPDATE product_content SET title_ar = ? WHERE id = ?").run(titleAr, id);
  return getCatalogItemByIdAny(id);
}

export function updateCatalogItemPrice(
  id: number,
  price: number
): ProductContentItem | null {
  const db = getDatabase();
  db.prepare("UPDATE product_content SET price = ? WHERE id = ?").run(price, id);
  return getCatalogItemByIdAny(id);
}

export function updateCatalogItemAcademyUrl(
  id: number,
  academyUrl: string | null
): ProductContentItem | null {
  const db = getDatabase();
  db.prepare("UPDATE product_content SET academy_url = ? WHERE id = ?").run(
    academyUrl,
    id
  );
  return getCatalogItemByIdAny(id);
}

export function deleteCatalogItem(id: number): boolean {
  const db = getDatabase();
  const result = db
    .prepare(`DELETE FROM product_content WHERE id = ? AND ${CATALOG_WHERE}`)
    .run(id);
  return result.changes > 0;
}

export function getCatalogItemContext(
  item: ProductContentItem
): CatalogItemContext | null {
  if (
    item.yearId == null ||
    item.subjectId == null ||
    item.catalogContentTypeId == null
  ) {
    return null;
  }

  const year = getSchoolYearById(item.yearId);
  const subject = getCatalogSubjectById(item.subjectId);
  const contentType = getCatalogContentTypeById(item.catalogContentTypeId);

  if (!year || !subject || !contentType) return null;

  return {
    yearName: year.nameAr,
    subjectName: subject.nameAr,
    contentTypeName: contentType.nameAr,
    contentTypeEmoji: contentType.emoji,
  };
}
