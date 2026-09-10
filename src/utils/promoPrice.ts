import { normalizeMoneyAmount, normalizePrice } from "./price";

const ALGIERS_TZ = "Africa/Algiers";

export type PromoDiscountType = "percent" | "fixed";

export interface PromoQuote {
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

export function algiersTodayYmd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ALGIERS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isPromoExpired(expiresAt: string | null, now = new Date()): boolean {
  if (!expiresAt) {
    return false;
  }
  return expiresAt < algiersTodayYmd(now);
}

export function normalizePromoCodeInput(raw: string): string | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) {
    return null;
  }
  if (!/^[A-Z0-9_-]{1,32}$/.test(code)) {
    return null;
  }
  return code;
}

export function parsePromoExpiryDate(text: string): string | null {
  const trimmed = text.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  let year: number;
  let month: number;
  let day: number;

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else {
    return null;
  }

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parsePercentValue(text: string): number | null {
  const trimmed = text.trim().replace(/%/g, "");
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0 || value > 100) {
    return null;
  }
  return value;
}

export function parsePositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return value;
}

export function calculatePromoQuote(
  originalPrice: number,
  discountType: PromoDiscountType,
  discountValue: number
): PromoQuote {
  const original = Math.max(0, Math.floor(originalPrice));
  let discountAmount = 0;

  if (discountType === "percent") {
    discountAmount = Math.round((original * discountValue) / 100);
  } else {
    discountAmount = Math.floor(discountValue);
  }

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    discountAmount = 0;
  }

  if (discountAmount > original) {
    discountAmount = original;
  }

  return {
    originalPrice: original,
    discountAmount,
    finalPrice: original - discountAmount,
  };
}

export function catalogPriceForPromo(price: unknown): number | null {
  return normalizePrice(price) ?? (normalizeMoneyAmount(price) === 0 ? 0 : null);
}
