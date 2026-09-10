import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export interface VideoEntitlement {
  id: number;
  telegramUserId: number;
  contentId: number;
  orderId: number | null;
  grantedAt: string;
}

interface EntitlementRow {
  id: number;
  telegram_user_id: number;
  content_id: number;
  order_id: number | null;
  granted_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): EntitlementRow | undefined {
  return stmt.get(...params) as unknown as EntitlementRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): EntitlementRow[] {
  return stmt.all(...params) as unknown as EntitlementRow[];
}

function mapRow(row: EntitlementRow): VideoEntitlement {
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    contentId: row.content_id,
    orderId: row.order_id,
    grantedAt: row.granted_at,
  };
}

/** Kept for existing entitlements and a later Academy account link. Do not call from Telegram checkout. */
export function grantVideoEntitlement(
  telegramUserId: number,
  contentId: number,
  orderId?: number | null
): VideoEntitlement {
  const db = getDatabase();
  db.prepare(
    `
      INSERT OR IGNORE INTO video_entitlements
        (telegram_user_id, content_id, order_id)
      VALUES (?, ?, ?)
    `
  ).run(telegramUserId, contentId, orderId ?? null);

  const row = getRow(
    db.prepare(
      `
        SELECT * FROM video_entitlements
        WHERE telegram_user_id = ? AND content_id = ?
      `
    ),
    telegramUserId,
    contentId
  );

  if (!row) {
    throw new Error("Failed to retrieve video entitlement after grant");
  }

  return mapRow(row);
}

export function userHasVideoEntitlement(
  telegramUserId: number,
  contentId: number
): boolean {
  const db = getDatabase();
  const row = getRow(
    db.prepare(
      `
        SELECT * FROM video_entitlements
        WHERE telegram_user_id = ? AND content_id = ?
      `
    ),
    telegramUserId,
    contentId
  );
  return Boolean(row);
}

export function getEntitlementsByUserId(
  telegramUserId: number
): VideoEntitlement[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare(
      `
        SELECT * FROM video_entitlements
        WHERE telegram_user_id = ?
        ORDER BY granted_at ASC, id ASC
      `
    ),
    telegramUserId
  );
  return rows.map(mapRow);
}

export function getEntitledContentIds(telegramUserId: number): number[] {
  return getEntitlementsByUserId(telegramUserId).map((row) => row.contentId);
}
