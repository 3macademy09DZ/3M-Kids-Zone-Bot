export type OrderStatus =
  | "pending"
  | "confirmed"
  | "invite_sent"
  | "completed"
  | "cancelled";

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
