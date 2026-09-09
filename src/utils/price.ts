export function formatPriceDzd(price: number | null | undefined): string {
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return "غير محدد";
  }
  return `${price} دج`;
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
