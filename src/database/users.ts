import type { User } from "grammy/types";
import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";

export interface TelegramUserProfile {
  telegramId: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  updatedAt: string;
}

interface UserRow {
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  updated_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): UserRow | undefined {
  return stmt.get(...params) as unknown as UserRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): UserRow[] {
  return stmt.all(...params) as unknown as UserRow[];
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanUsername(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/^@+/, "");
  return trimmed ? trimmed : null;
}

function mapRow(row: UserRow): TelegramUserProfile {
  return {
    telegramId: Number(row.telegram_id),
    firstName: cleanText(row.first_name),
    lastName: cleanText(row.last_name),
    username: cleanUsername(row.username),
    updatedAt: row.updated_at,
  };
}

export function upsertTelegramUser(user: User | undefined): void {
  if (!user?.id) {
    return;
  }

  const db = getDatabase();
  db.prepare(
    `
      INSERT INTO telegram_users (telegram_id, first_name, last_name, username, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(telegram_id) DO UPDATE SET
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        username = excluded.username,
        updated_at = datetime('now')
    `
  ).run(
    user.id,
    cleanText(user.first_name),
    cleanText(user.last_name),
    cleanUsername(user.username)
  );
}

export function getTelegramUserById(
  telegramId: number
): TelegramUserProfile | null {
  const db = getDatabase();
  const row = getRow(
    db.prepare("SELECT * FROM telegram_users WHERE telegram_id = ?"),
    telegramId
  );
  return row ? mapRow(row) : null;
}

export function getTelegramUsersByIds(
  telegramIds: number[]
): Map<number, TelegramUserProfile> {
  const result = new Map<number, TelegramUserProfile>();
  if (telegramIds.length === 0) {
    return result;
  }

  const db = getDatabase();
  const placeholders = telegramIds.map(() => "?").join(", ");
  const rows = getAllRows(
    db.prepare(
      `SELECT * FROM telegram_users WHERE telegram_id IN (${placeholders})`
    ),
    ...telegramIds
  );

  for (const row of rows) {
    const profile = mapRow(row);
    result.set(profile.telegramId, profile);
  }

  return result;
}

export function formatUserDisplayName(
  profile: TelegramUserProfile | null | undefined,
  telegramId: number,
  fallbackUsername?: string | null
): string {
  const first = profile?.firstName?.trim() ?? "";
  const last = profile?.lastName?.trim() ?? "";
  const fullName = [first, last].filter(Boolean).join(" ");
  if (fullName) {
    return fullName;
  }

  const username = formatUsernameHandle(
    profile?.username ?? fallbackUsername
  );
  if (username) {
    return username;
  }

  return String(telegramId);
}

export function formatUsernameHandle(
  username: string | null | undefined
): string | null {
  const clean = cleanUsername(username);
  return clean ? `@${clean}` : null;
}
