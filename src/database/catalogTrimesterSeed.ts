import type { DatabaseSync } from "node:sqlite";

export const DEFAULT_SUBJECT_TRIMESTERS = [
  { nameAr: "الفصل الأول", emoji: "📘", sortOrder: 1 },
  { nameAr: "الفصل الثاني", emoji: "📗", sortOrder: 2 },
  { nameAr: "الفصل الثالث", emoji: "📙", sortOrder: 3 },
] as const;

export function ensureDefaultTrimestersForSubjectInDb(
  database: DatabaseSync,
  subjectId: number
): void {
  const findTrimester = database.prepare(`
    SELECT id FROM catalog_trimesters
    WHERE subject_id = ? AND name_ar = ?
    LIMIT 1
  `);
  const insertTrimester = database.prepare(`
    INSERT INTO catalog_trimesters (subject_id, name_ar, emoji, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  for (const trimester of DEFAULT_SUBJECT_TRIMESTERS) {
    const existing = findTrimester.get(subjectId, trimester.nameAr) as
      | { id: number }
      | undefined;
    if (existing) {
      continue;
    }
    insertTrimester.run(
      subjectId,
      trimester.nameAr,
      trimester.emoji,
      trimester.sortOrder
    );
  }
}

export function seedDefaultTrimestersForAllSubjects(
  database: DatabaseSync
): void {
  const rows = database
    .prepare("SELECT id FROM catalog_subjects ORDER BY id ASC")
    .all() as { id: number }[];

  for (const row of rows) {
    ensureDefaultTrimestersForSubjectInDb(database, row.id);
  }
}
