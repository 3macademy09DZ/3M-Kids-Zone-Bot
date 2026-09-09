import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { CreateOrderInput, Order, OrderStatus } from "./types";
import { isPendingOrderStatus } from "./types";

interface OrderRow {
  id: number;
  telegram_user_id: number;
  telegram_username: string | null;
  product_id: string;
  status: string;
  created_at: string;
  invite_link: string | null;
  invite_link_name: string | null;
  notes: string | null;
}

function normalizeOrderStatus(status: string): OrderStatus {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "review") {
    return "pending";
  }
  return normalized as OrderStatus;
}

function mapRow(row: OrderRow): Order {
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    productId: row.product_id,
    status: normalizeOrderStatus(row.status),
    createdAt: row.created_at,
    inviteLink: row.invite_link,
    inviteLinkName: row.invite_link_name,
    notes: row.notes,
  };
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): OrderRow | undefined {
  return stmt.get(...params) as unknown as OrderRow | undefined;
}

function getAllRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): OrderRow[] {
  return stmt.all(...params) as unknown as OrderRow[];
}

export function createOrder(input: CreateOrderInput): Order {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO orders (telegram_user_id, telegram_username, product_id, notes)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.telegramUserId,
    input.telegramUsername,
    input.productId,
    input.notes ?? null
  );

  const order = getOrderById(Number(result.lastInsertRowid));
  if (!order) {
    throw new Error("Failed to retrieve order after creation");
  }
  return order;
}

export function getOrderById(id: number): Order | null {
  const db = getDatabase();
  const row = getRow(db.prepare("SELECT * FROM orders WHERE id = ?"), id);
  return row ? mapRow(row) : null;
}

export function getAllOrders(): Order[] {
  const db = getDatabase();
  const rows = getAllRows(db.prepare("SELECT * FROM orders ORDER BY id DESC"));
  return rows.map(mapRow);
}

export function getOrdersByUserId(telegramUserId: number): Order[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare("SELECT * FROM orders WHERE telegram_user_id = ? ORDER BY id DESC"),
    telegramUserId
  );
  return rows.map(mapRow);
}

const PURCHASED_STATUSES: OrderStatus[] = [
  "confirmed",
  "invite_sent",
  "completed",
];

export function getPurchasedOrdersByUserId(telegramUserId: number): Order[] {
  const db = getDatabase();
  const placeholders = PURCHASED_STATUSES.map(() => "?").join(", ");
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM orders
      WHERE telegram_user_id = ?
        AND status IN (${placeholders})
      ORDER BY id DESC
    `),
    telegramUserId,
    ...PURCHASED_STATUSES
  );
  return rows.map(mapRow);
}

export function updateOrderStatus(id: number, status: OrderStatus): Order | null {
  const db = getDatabase();
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  return getOrderById(id);
}

export type ApproveOrderResult =
  | { ok: true; order: Order; alreadyApproved: boolean }
  | { ok: false; reason: "not_found" | "not_pending" };

export function approveOrder(id: number): ApproveOrderResult {
  const order = getOrderById(id);
  if (!order) {
    return { ok: false, reason: "not_found" };
  }

  if (!isPendingOrderStatus(order.status)) {
    if (PURCHASED_STATUSES.includes(order.status)) {
      return { ok: true, order, alreadyApproved: true };
    }
    return { ok: false, reason: "not_pending" };
  }

  const updated = updateOrderStatus(id, "confirmed");
  if (!updated) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, order: updated, alreadyApproved: false };
}

export function updateOrderInviteLink(
  id: number,
  inviteLink: string,
  inviteLinkName: string
): Order | null {
  const db = getDatabase();
  db.prepare(`
    UPDATE orders
    SET invite_link = ?, invite_link_name = ?, status = 'invite_sent'
    WHERE id = ?
  `).run(inviteLink, inviteLinkName, id);
  return getOrderById(id);
}

export function getNextInviteLinkName(): string {
  const db = getDatabase();
  const row = getRow(db.prepare("SELECT COUNT(*) as count FROM orders")) as
    | { count: number }
    | undefined;
  const nextNumber = (row?.count ?? 0) + 1;
  return `order-${String(nextNumber).padStart(3, "0")}`;
}

export function getUniqueCustomerIds(): number[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare("SELECT DISTINCT telegram_user_id FROM orders ORDER BY telegram_user_id")
  ) as { telegram_user_id: number }[];
  return rows.map((r) => r.telegram_user_id);
}

export function getOrdersWithInviteLinks(): Order[] {
  const db = getDatabase();
  const rows = getAllRows(
    db.prepare("SELECT * FROM orders WHERE invite_link IS NOT NULL ORDER BY id DESC")
  );
  return rows.map(mapRow);
}
