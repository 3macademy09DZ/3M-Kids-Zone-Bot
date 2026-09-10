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
}

export interface CreateOrderInput {
  telegramUserId: number;
  telegramUsername: string | null;
  productId: string;
  contentId: number;
  notes?: string | null;
}
