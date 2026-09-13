import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { CreateSchoolYearInput, SchoolYear } from "./catalogTypes";

interface YearRow {
  id: number;
  name_ar: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): YearRow | undefined {
  return stmt.get(...params) as unknown as YearRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): YearRow[] {
  return stmt.all(...params) as unknown as YearRow[];
}

function mapRow(row: YearRow): SchoolYear {
  return {
    id: row.id,
    nameAr: row.name_ar,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function createSchoolYear(input: CreateSchoolYearInput): SchoolYear {
  const db = getDatabase();
  const maxRow = getRow(
    db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM catalog_school_years")
  ) as { max_sort: number } | undefined;
  const sortOrder = input.sortOrder ?? (maxRow?.max_sort ?? 0) + 1;

  const result = db
    .prepare(
      "INSERT INTO catalog_school_years (name_ar, sort_order) VALUES (?, ?)"
    )
    .run(input.nameAr, sortOrder);

  const year = getSchoolYearById(Number(result.lastInsertRowid));
  if (!year) throw new Error("Failed to retrieve school year after creation");
  return year;
}

export function getSchoolYearById(id: number): SchoolYear | null {
  const db = getDatabase();
  const row = getRow(db.prepare("SELECT * FROM catalog_school_years WHERE id = ?"), id);
  return row ? mapRow(row) : null;
}

export function getActiveSchoolYears(): SchoolYear[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM catalog_school_years
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    `)
  );
  return rows.map(mapRow);
}

export function getAllSchoolYears(): SchoolYear[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare("SELECT * FROM catalog_school_years ORDER BY sort_order ASC, id ASC")
  );
  return rows.map(mapRow);
}

export function updateSchoolYearName(id: number, nameAr: string): SchoolYear | null {
  const db = getDatabase();
  db.prepare("UPDATE catalog_school_years SET name_ar = ? WHERE id = ?").run(nameAr, id);
  return getSchoolYearById(id);
}

export function setSchoolYearActive(id: number, isActive: boolean): SchoolYear | null {
  const db = getDatabase();
  db.prepare("UPDATE catalog_school_years SET is_active = ? WHERE id = ?").run(
    isActive ? 1 : 0,
    id
  );
  return getSchoolYearById(id);
}
