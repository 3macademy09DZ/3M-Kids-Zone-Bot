import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import {
  isPromoExpired,
  normalizePromoCodeInput,
  type PromoDiscountType,
} from "../utils/promoPrice";

export interface PromoCode {
  id: number;
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
}

export type PromoValidationReason =
  | "not_found"
  | "inactive"
  | "expired"
  | "max_uses"
  | "invalid";

export type PromoValidationResult =
  | { ok: true; promo: PromoCode }
  | { ok: false; reason: PromoValidationReason };

export interface CreatePromoInput {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  expiresAt: string | null;
  maxUses: number | null;
}

interface PromoRow {
  id: number;
  code: string;
  discount_type: string;
  discount_value: number;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  is_active: number;
  created_at: string;
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): PromoRow | undefined {
  return stmt.get(...params) as unknown as PromoRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): PromoRow[] {
  return stmt.all(...params) as unknown as PromoRow[];
}

function normalizeDiscountType(value: string): PromoDiscountType {
  return value === "fixed" ? "fixed" : "percent";
}

function mapRow(row: PromoRow): PromoCode {
  return {
    id: row.id,
    code: row.code,
    discountType: normalizeDiscountType(row.discount_type),
    discountValue: Number(row.discount_value),
    expiresAt: row.expires_at ?? null,
    maxUses: row.max_uses == null ? null : Number(row.max_uses),
    usedCount: Number(row.used_count ?? 0),
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at,
  };
}

export function getPromoById(id: number): PromoCode | null {
  const db = getDatabase();
  const row = getRow(db.prepare("SELECT * FROM promo_codes WHERE id = ?"), id);
  return row ? mapRow(row) : null;
}

export function getPromoByCode(code: string): PromoCode | null {
  const normalized = normalizePromoCodeInput(code);
  if (!normalized) {
    return null;
  }
  const db = getDatabase();
  const row = getRow(
    db.prepare("SELECT * FROM promo_codes WHERE code = ?"),
    normalized
  );
  return row ? mapRow(row) : null;
}

export function listPromoCodes(): PromoCode[] {
  const db = getDatabase();
  return getAllRows(
    db.prepare("SELECT * FROM promo_codes ORDER BY id DESC")
  ).map(mapRow);
}

export function createPromoCode(input: CreatePromoInput): PromoCode {
  const db = getDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO promo_codes (
          code, discount_type, discount_value, expires_at, max_uses, used_count, is_active
        )
        VALUES (?, ?, ?, ?, ?, 0, 1)
      `
    )
    .run(
      input.code,
      input.discountType,
      input.discountValue,
      input.expiresAt,
      input.maxUses
    );

  const created = getPromoById(Number(result.lastInsertRowid));
  if (!created) {
    throw new Error("Failed to retrieve promo code after creation");
  }
  return created;
}

export function setPromoActive(id: number, isActive: boolean): PromoCode | null {
  const db = getDatabase();
  db.prepare("UPDATE promo_codes SET is_active = ? WHERE id = ?").run(
    isActive ? 1 : 0,
    id
  );
  return getPromoById(id);
}

export function promoHasOrderHistory(code: string): boolean {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT 1 AS found
        FROM orders
        WHERE promo_code = ?
        LIMIT 1
      `
    )
    .get(code) as { found: number } | undefined;
  return Boolean(row?.found);
}

export function deleteOrDeactivatePromo(
  id: number
): { ok: true; mode: "deleted" | "deactivated"; promo?: PromoCode } | { ok: false } {
  const promo = getPromoById(id);
  if (!promo) {
    return { ok: false };
  }

  if (promo.usedCount > 0 || promoHasOrderHistory(promo.code)) {
    const updated = setPromoActive(id, false);
    return { ok: true, mode: "deactivated", promo: updated ?? promo };
  }

  const db = getDatabase();
  db.prepare("DELETE FROM promo_codes WHERE id = ?").run(id);
  return { ok: true, mode: "deleted" };
}

export function validatePromoForCheckout(
  rawCode: string,
  now = new Date()
): PromoValidationResult {
  const normalized = normalizePromoCodeInput(rawCode);
  if (!normalized) {
    return { ok: false, reason: "invalid" };
  }

  const promo = getPromoByCode(normalized);
  if (!promo) {
    return { ok: false, reason: "not_found" };
  }
  if (!promo.isActive) {
    return { ok: false, reason: "inactive" };
  }
  if (isPromoExpired(promo.expiresAt, now)) {
    return { ok: false, reason: "expired" };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, reason: "max_uses" };
  }

  return { ok: true, promo };
}

export function consumePromoUseForOrder(
  orderId: number,
  promoCode: string | null
): void {
  if (!promoCode) {
    return;
  }

  const db = getDatabase();
  const marked = db
    .prepare(
      `
        UPDATE orders
        SET promo_counted = 1
        WHERE id = ?
          AND IFNULL(promo_counted, 0) = 0
          AND promo_code IS NOT NULL
          AND TRIM(promo_code) != ''
      `
    )
    .run(orderId);

  if (Number(marked.changes) !== 1) {
    return;
  }

  db.prepare(
    "UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?"
  ).run(promoCode);
}
