export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "payment_pending_review"
  | "rejected_payment"
  | "approved"
  | "confirmed"
  | "invite_sent"
  | "completed"
  | "cancelled";

export type PaymentMethod = "ccp" | "redotpay";

export function isPendingOrderStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "pending" || normalized === "review";
}

export function isPaymentReviewStatus(status: string): boolean {
  return status.trim().toLowerCase() === "payment_pending_review";
}

export function isRejectedPaymentStatus(status: string): boolean {
  return status.trim().toLowerCase() === "rejected_payment";
}

export const ADMIN_ORDER_SECTIONS = [
  "review",
  "wait",
  "approved",
  "rejected",
  "all",
] as const;

export type AdminOrderSection = (typeof ADMIN_ORDER_SECTIONS)[number];

export function getAdminOrderSection(
  status: string
): Exclude<AdminOrderSection, "all"> | null {
  const normalized = status.trim().toLowerCase();

  if (
    normalized === "payment_pending_review" ||
    normalized === "pending" ||
    normalized === "review"
  ) {
    return "review";
  }

  if (normalized === "awaiting_payment") {
    return "wait";
  }

  if (normalized === "rejected_payment" || normalized === "cancelled") {
    return "rejected";
  }

  if (
    normalized === "approved" ||
    normalized === "confirmed" ||
    normalized === "invite_sent" ||
    normalized === "completed"
  ) {
    return "approved";
  }

  return null;
}

export function orderBelongsToAdminSection(
  status: string,
  section: AdminOrderSection
): boolean {
  if (section === "all") {
    return true;
  }
  return getAdminOrderSection(status) === section;
}

export interface Order {
  id: number;
  orderNumber: string | null;
  telegramUserId: number;
  telegramUsername: string | null;
  productId: string;
  contentId: number | null;
  status: OrderStatus;
  createdAt: string;
  inviteLink: string | null;
  inviteLinkName: string | null;
  notes: string | null;
  paymentMethod: PaymentMethod | null;
  paymentProofFileId: string | null;
  paymentProofMediaKind: "photo" | "document" | null;
  paymentSubmittedAt: string | null;
  paymentReviewedAt: string | null;
  purchasePrice: number | null;
}

export interface CreateOrderInput {
  telegramUserId: number;
  telegramUsername: string | null;
  productId: string;
  contentId: number;
  purchasePrice?: number | null;
  notes?: string | null;
}
