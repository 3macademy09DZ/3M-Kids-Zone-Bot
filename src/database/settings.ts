import { getDatabase } from "./db";

export const SETTINGS_KEYS = {
  CHANNEL_ID: "channel_id",
  CHANNEL_ENABLED: "channel_enabled",
  CONTACT_USERNAME: "contact_username",
  CONTACT_ENABLED: "contact_enabled",
  CCP_ACCOUNT_INFO: "ccp_account_info",
  BARIDIMOB_RIP: "baridimob_rip",
  PAYMENT_ACCOUNT_NAME: "payment_account_name",
  REDOTPAY_PAYMENT_INFO: "redotpay_payment_info",
  CCP_ENABLED: "ccp_enabled",
  REDOTPAY_ENABLED: "redotpay_enabled",
  ADMIN_USERNAME: "admin_username",
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

const FORBIDDEN_KEYS = new Set(["bot_token", "admin_telegram_id"]);

export function getSettingOverride(key: string): string | undefined {
  const db = getDatabase();
  const row = db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row ? String(row.value) : undefined;
}

export function setSettingOverride(key: string, value: string): void {
  if (FORBIDDEN_KEYS.has(key) || FORBIDDEN_KEYS.has(key.toLowerCase())) {
    throw new Error("This setting cannot be stored");
  }

  const db = getDatabase();
  db.prepare(
    `
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `
  ).run(key, value);
}

export function deleteSettingOverride(key: string): void {
  if (FORBIDDEN_KEYS.has(key) || FORBIDDEN_KEYS.has(key.toLowerCase())) {
    throw new Error("This setting cannot be deleted");
  }

  const db = getDatabase();
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}
