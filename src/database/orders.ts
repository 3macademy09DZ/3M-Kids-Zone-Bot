import { getDatabase } from "./db";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { grantVideoEntitlement } from "./entitlements";
import { consumePromoUseForOrder } from "./promos";
import type { CreateOrderInput, Order, OrderStatus, PaymentMethod } from "./types";
import { isPendingOrderStatus } from "./types";
import { formatOrderNumber } from "../utils/orderNumber";
import { normalizeMoneyAmount } from "../utils/price";

interface OrderRow {
  id: number;
  order_number: string | null;
  telegram_user_id: number;
  telegram_username: string | null;
  product_id: string;
  content_id: number | null;
  status: string;
  created_at: string;
  invite_link: string | null;
  invite_link_name: string | null;
  notes: string | null;
  payment_method: string | null;
  payment_proof_file_id: string | null;
  payment_proof_media_kind: string | null;
  payment_submitted_at: string | null;
  payment_reviewed_at: string | null;
  purchase_price: number | null;
  promo_code: string | null;
  original_price: number | null;
  discount_amount: number | null;
  promo_counted: number | null;
}

function normalizeOrderStatus(status: string): OrderStatus {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "review") {
    return "pending";
  }
  return normalized as OrderStatus;
}

function normalizePaymentMethod(value: string | null): PaymentMethod | null {
  if (value === "ccp" || value === "redotpay") {
    return value;
  }
  return null;
}

function normalizeProofKind(
  value: string | null
): "photo" | "document" | null {
  if (value === "photo" || value === "document") {
    return value;
  }
  return null;
}

function mapRow(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number ?? null,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    productId: row.product_id,
    contentId: row.content_id ?? null,
    status: normalizeOrderStatus(row.status),
    createdAt: row.created_at,
    inviteLink: row.invite_link,
    inviteLinkName: row.invite_link_name,
    notes: row.notes,
    paymentMethod: normalizePaymentMethod(row.payment_method),
    paymentProofFileId: row.payment_proof_file_id ?? null,
    paymentProofMediaKind: normalizeProofKind(row.payment_proof_media_kind),
    paymentSubmittedAt: row.payment_submitted_at ?? null,
    paymentReviewedAt: row.payment_reviewed_at ?? null,
    purchasePrice: normalizeMoneyAmount(row.purchase_price),
    promoCode: row.promo_code?.trim() ? row.promo_code.trim() : null,
    originalPrice: normalizeMoneyAmount(row.original_price),
    discountAmount: normalizeMoneyAmount(row.discount_amount),
    promoCounted: Number(row.promo_counted ?? 0) === 1,
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
    INSERT INTO orders (
      telegram_user_id,
      telegram_username,
      product_id,
      content_id,
      notes,
      status,
      purchase_price,
      promo_code,
      original_price,
      discount_amount,
      promo_counted
    )
    VALUES (?, ?, ?, ?, ?, 'awaiting_payment', ?, ?, ?, ?, 0)
  `);

  const result = stmt.run(
    input.telegramUserId,
    input.telegramUsername,
    input.productId,
    input.contentId,
    input.notes ?? null,
    normalizeMoneyAmount(input.purchasePrice),
    input.promoCode?.trim() ? input.promoCode.trim() : null,
    normalizeMoneyAmount(input.originalPrice),
    normalizeMoneyAmount(input.discountAmount)
  );

  const orderId = Number(result.lastInsertRowid);
  db.prepare("UPDATE orders SET order_number = ? WHERE id = ? AND (order_number IS NULL OR order_number = '')").run(
    formatOrderNumber(orderId),
    orderId
  );

  const order = getOrderById(orderId);
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
  "approved",
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

export function getAllPurchasedOrders(): Order[] {
  const db = getDatabase();
  const placeholders = PURCHASED_STATUSES.map(() => "?").join(", ");
  const rows = getAllRows(
    db.prepare(`
      SELECT * FROM orders
      WHERE status IN (${placeholders})
      ORDER BY id DESC
    `),
    ...PURCHASED_STATUSES
  );
  return rows.map(mapRow);
}

export function updateOrderStatus(id: number, status: OrderStatus): Order | null {
  const db = getDatabase();
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
  return getOrderById(id);
}

export function setOrderPaymentMethod(
  id: number,
  paymentMethod: PaymentMethod
): Order | null {
  const db = getDatabase();
  db.prepare("UPDATE orders SET payment_method = ? WHERE id = ?").run(
    paymentMethod,
    id
  );
  return getOrderById(id);
}

export function submitOrderPaymentProof(
  id: number,
  fileId: string,
  mediaKind: "photo" | "document"
): Order | null {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE orders
      SET payment_proof_file_id = ?,
          payment_proof_media_kind = ?,
          payment_submitted_at = datetime('now'),
          status = 'payment_pending_review'
      WHERE id = ?
    `
  ).run(fileId, mediaKind, id);
  return getOrderById(id);
}

export type ApproveOrderResult =
  | { ok: true; order: Order; alreadyApproved: boolean }
  | { ok: false; reason: "not_found" | "not_pending" | "missing_proof" };

function grantApprovedOrder(order: Order): Order | null {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `
        UPDATE orders
        SET status = 'approved',
            payment_reviewed_at = datetime('now')
        WHERE id = ?
      `
    ).run(order.id);

    consumePromoUseForOrder(order.id, order.promoCode);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const updated = getOrderById(order.id);
  if (updated?.contentId != null) {
    grantVideoEntitlement(updated.telegramUserId, updated.contentId, updated.id);
  }
  return updated;
}

export function approvePayment(id: number): ApproveOrderResult {
  const order = getOrderById(id);
  if (!order) {
    return { ok: false, reason: "not_found" };
  }

  if (PURCHASED_STATUSES.includes(order.status)) {
    if (order.contentId != null) {
      grantVideoEntitlement(order.telegramUserId, order.contentId, order.id);
    }
    return { ok: true, order, alreadyApproved: true };
  }

  if (order.status !== "payment_pending_review") {
    return { ok: false, reason: "not_pending" };
  }

  if (!order.paymentProofFileId) {
    return { ok: false, reason: "missing_proof" };
  }

  const updated = grantApprovedOrder(order);
  if (!updated) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, order: updated, alreadyApproved: false };
}

export function rejectPayment(id: number): ApproveOrderResult {
  const order = getOrderById(id);
  if (!order) {
    return { ok: false, reason: "not_found" };
  }

  if (PURCHASED_STATUSES.includes(order.status)) {
    return { ok: true, order, alreadyApproved: true };
  }

  if (order.status !== "payment_pending_review") {
    return { ok: false, reason: "not_pending" };
  }

  const db = getDatabase();
  db.prepare(
    `
      UPDATE orders
      SET status = 'rejected_payment',
          payment_reviewed_at = datetime('now')
      WHERE id = ?
    `
  ).run(id);

  const updated = getOrderById(id);
  if (!updated) {
    return { ok: false, reason: "not_found" };
  }

  return { ok: true, order: updated, alreadyApproved: false };
}

export function approveOrder(id: number): ApproveOrderResult {
  const order = getOrderById(id);
  if (!order) {
    return { ok: false, reason: "not_found" };
  }

  if (!isPendingOrderStatus(order.status) && order.status !== "awaiting_payment") {
    if (PURCHASED_STATUSES.includes(order.status)) {
      if (order.contentId != null) {
        grantVideoEntitlement(order.telegramUserId, order.contentId, order.id);
      }
      return { ok: true, order, alreadyApproved: true };
    }
    return { ok: false, reason: "not_pending" };
  }

  const updated = grantApprovedOrder(order);
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
    db.prepare(`
      SELECT telegram_user_id
      FROM orders
      GROUP BY telegram_user_id
      ORDER BY MAX(id) DESC
    `)
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
