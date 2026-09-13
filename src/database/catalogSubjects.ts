import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { CatalogSubject, CreateCatalogSubjectInput } from "./catalogTypes";

interface SubjectRow {
  id: number;
  year_id: number;
  name_ar: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): SubjectRow | undefined {
  return stmt.get(...params) as unknown as SubjectRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): SubjectRow[] {
  return stmt.all(...params) as unknown as SubjectRow[];
}

function mapRow(row: SubjectRow): CatalogSubject {
  return {
    id: row.id,
    yearId: row.year_id,
    nameAr: row.name_ar,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function createCatalogSubject(
  input: CreateCatalogSubjectInput
): CatalogSubject {
  const db = getDatabase();
  const maxRow = getRow(
    db.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM catalog_subjects WHERE year_id = ?"
    ),
    input.yearId
  ) as { max_sort: number } | undefined;
  const sortOrder = input.sortOrder ?? (maxRow?.max_sort ?? 0) + 1;

  const result = db
    .prepare(
      "INSERT INTO catalog_subjects (year_id, name_ar, sort_order) VALUES (?, ?, ?)"
    )
    .run(input.yearId, input.nameAr, sortOrder);

  const subject = getCatalogSubjectById(Number(result.lastInsertRowid));
  if (!subject) throw new Error("Failed to retrieve subject after creation");
  return subject;
}

export function getCatalogSubjectById(id: number): CatalogSubject | null {
  const db = getDatabase();
  const row = getRow(db.prepare("SELECT * FROM catalog_subjects WHERE id = ?"), id);
  return row ? mapRow(row) : null;
}

export function getActiveSubjectsByYearId(yearId: number): CatalogSubject[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM catalog_subjects
      WHERE year_id = ? AND is_active = 1
      ORDER BY sort_order ASC, id ASC
    `),
    yearId
  );
  return rows.map(mapRow);
}

export function getAllSubjectsByYearId(yearId: number): CatalogSubject[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM catalog_subjects
      WHERE year_id = ?
      ORDER BY sort_order ASC, id ASC
    `),
    yearId
  );
  return rows.map(mapRow);
}

export function updateCatalogSubjectName(
  id: number,
  nameAr: string
): CatalogSubject | null {
  const db = getDatabase();
  db.prepare("UPDATE catalog_subjects SET name_ar = ? WHERE id = ?").run(nameAr, id);
  return getCatalogSubjectById(id);
}

export function setCatalogSubjectActive(
  id: number,
  isActive: boolean
): CatalogSubject | null {
  const db = getDatabase();
  db.prepare("UPDATE catalog_subjects SET is_active = ? WHERE id = ?").run(
    isActive ? 1 : 0,
    id
  );
  return getCatalogSubjectById(id);
}
