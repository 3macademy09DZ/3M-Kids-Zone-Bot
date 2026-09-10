import type { PromoDiscountType } from "../utils/promoPrice";

export type AdminPromoStep =
  | "awaiting_code"
  | "awaiting_type"
  | "awaiting_value"
  | "awaiting_expiry"
  | "awaiting_max_uses";

export interface AdminPromoSession {
  step: AdminPromoStep;
  code?: string;
  discountType?: PromoDiscountType;
  discountValue?: number;
  expiresAt?: string | null;
}

const sessions = new Map<number, AdminPromoSession>();

export function setAdminPromoSession(
  adminId: number,
  session: AdminPromoSession
): void {
  sessions.set(adminId, session);
}

export function getAdminPromoSession(
  adminId: number
): AdminPromoSession | undefined {
  return sessions.get(adminId);
}

export function clearAdminPromoSession(adminId: number): void {
  sessions.delete(adminId);
}
