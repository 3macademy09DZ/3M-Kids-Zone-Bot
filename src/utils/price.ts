export function normalizePrice(price: unknown): number | null {
  if (price == null || price === "") {
    return null;
  }

  if (typeof price === "bigint") {
    const asNumber = Number(price);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : null;
  }

  if (typeof price === "number") {
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  if (typeof price === "string") {
    const parsed = Number(price.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

export function formatPriceDzd(price: unknown): string {
  const normalized = normalizePrice(price);
  if (normalized == null) {
    return "غير محدد";
  }
  return `${normalized} دج`;
}

export function formatAmountDzd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return "0 دج";
  }
  return formatPriceDzd(amount);
}

export function parsePriceDzd(text: string): number | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d+)\s*(?:دج|DZD)?$/i);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}

export const INVALID_PRICE_MESSAGE =
  "❌ السعر غير صالح.\n" +
  "أرسل رقمًا صحيحًا *أكبر من 0* بالدينار الجزائري.\n" +
  "مثال: `500`";
