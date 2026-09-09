export type OrderStatus =
  | "pending"
  | "confirmed"
  | "invite_sent"
  | "completed"
  | "cancelled";

export function isPendingOrderStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized === "pending" || normalized === "review";
}

export interface Order {
  id: number;
  telegramUserId: number;
  telegramUsername: string | null;
  productId: string;
  status: OrderStatus;
  createdAt: string;
  inviteLink: string | null;
  inviteLinkName: string | null;
  notes: string | null;
}

export interface CreateOrderInput {
  telegramUserId: number;
  telegramUsername: string | null;
  productId: string;
  notes?: string | null;
}
