import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type {
  CatalogContentType,
  CreateCatalogContentTypeInput,
} from "./catalogTypes";

interface TypeRow {
  id: number;
  slug: string;
  name_ar: string;
  emoji: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): TypeRow | undefined {
  return stmt.get(...params) as unknown as TypeRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): TypeRow[] {
  return stmt.all(...params) as unknown as TypeRow[];
}

function mapRow(row: TypeRow): CatalogContentType {
  return {
    id: row.id,
    slug: row.slug,
    nameAr: row.name_ar,
    emoji: row.emoji,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function createCatalogContentType(
  input: CreateCatalogContentTypeInput
): CatalogContentType {
  const db = getDatabase();
  const maxRow = getRow(
    db.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM catalog_content_types"
    )
  ) as { max_sort: number } | undefined;
  const sortOrder = input.sortOrder ?? (maxRow?.max_sort ?? 0) + 1;

  const result = db
    .prepare(`
      INSERT INTO catalog_content_types (slug, name_ar, emoji, sort_order)
      VALUES (?, ?, ?, ?)
    `)
    .run(input.slug, input.nameAr, input.emoji ?? "📄", sortOrder);

  const type = getCatalogContentTypeById(Number(result.lastInsertRowid));
  if (!type) throw new Error("Failed to retrieve content type after creation");
  return type;
}

export function getCatalogContentTypeById(id: number): CatalogContentType | null {
  const db = getDatabase();
  const row = getRow(
    db.prepare("SELECT * FROM catalog_content_types WHERE id = ?"),
    id
  );
  return row ? mapRow(row) : null;
}

export function getActiveCatalogContentTypes(): CatalogContentType[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM catalog_content_types
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `)
  );
  return rows.map(mapRow);
}

export function getAllCatalogContentTypes(): CatalogContentType[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare("SELECT * FROM catalog_content_types ORDER BY sort_order ASC, id ASC")
  );
  return rows.map(mapRow);
}

export function updateCatalogContentTypeName(
  id: number,
  nameAr: string,
  emoji?: string
): CatalogContentType | null {
  const db = getDatabase();
  if (emoji != null) {
    db.prepare(
      "UPDATE catalog_content_types SET name_ar = ?, emoji = ? WHERE id = ?"
    ).run(nameAr, emoji, id);
  } else {
    db.prepare("UPDATE catalog_content_types SET name_ar = ? WHERE id = ?").run(
      nameAr,
      id
    );
  }
  return getCatalogContentTypeById(id);
}

export function setCatalogContentTypeActive(
  id: number,
  isActive: boolean
): CatalogContentType | null {
  const db = getDatabase();
  db.prepare("UPDATE catalog_content_types SET is_active = ? WHERE id = ?").run(
    isActive ? 1 : 0,
    id
  );
  return getCatalogContentTypeById(id);
}
