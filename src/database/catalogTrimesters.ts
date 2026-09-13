import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { CatalogTrimester } from "./catalogTypes";
import {
  ensureDefaultTrimestersForSubjectInDb,
} from "./catalogTrimesterSeed";

export { DEFAULT_SUBJECT_TRIMESTERS } from "./catalogTrimesterSeed";

interface TrimesterRow {
  id: number;
  subject_id: number;
  name_ar: string;
  emoji: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): TrimesterRow | undefined {
  return stmt.get(...params) as unknown as TrimesterRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): TrimesterRow[] {
  return stmt.all(...params) as unknown as TrimesterRow[];
}

function mapRow(row: TrimesterRow): CatalogTrimester {
  return {
    id: row.id,
    subjectId: row.subject_id,
    nameAr: row.name_ar,
    emoji: row.emoji,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function ensureDefaultTrimestersForSubject(subjectId: number): void {
  ensureDefaultTrimestersForSubjectInDb(getDatabase(), subjectId);
}

export function getTrimesterById(id: number): CatalogTrimester | null {
  const db = getDatabase();
  const row = getRow(
    db.prepare("SELECT * FROM catalog_trimesters WHERE id = ?"),
    id
  );
  return row ? mapRow(row) : null;
}

export function getTrimestersBySubjectId(subjectId: number): CatalogTrimester[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM catalog_trimesters
      WHERE subject_id = ?
      ORDER BY sort_order ASC, id ASC
    `),
    subjectId
  );
  return rows.map(mapRow);
}
