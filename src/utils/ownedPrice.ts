import { getEntitlementsByUserId } from "../database/entitlements";
import { getContentItemById } from "../database/content";
import { getPurchasedOrdersByUserId } from "../database/orders";
import type { Order } from "../database/types";
import { normalizeMoneyAmount, normalizePrice } from "./price";

function oldestPurchasedOrder(orders: Order[]): Order | null {
  if (orders.length === 0) {
    return null;
  }

  return [...orders].sort((a, b) => a.id - b.id)[0] ?? null;
}

export function getOwnedContentPriceMap(
  telegramUserId: number
): Map<number, number> {
  const prices = new Map<number, number>();
  const entitlements = getEntitlementsByUserId(telegramUserId);
  const purchased = getPurchasedOrdersByUserId(telegramUserId);
  const purchasedById = new Map(purchased.map((order) => [order.id, order]));
  const purchasedByContent = new Map<number, Order[]>();

  for (const order of purchased) {
    if (order.contentId == null) {
      continue;
    }
    const list = purchasedByContent.get(order.contentId) ?? [];
    list.push(order);
    purchasedByContent.set(order.contentId, list);
  }

  for (const entitlement of entitlements) {
    let order: Order | null = null;

    if (entitlement.orderId != null) {
      const linked = purchasedById.get(entitlement.orderId);
      if (linked && linked.contentId === entitlement.contentId) {
        order = linked;
      }
    }

    if (!order) {
      order = oldestPurchasedOrder(
        purchasedByContent.get(entitlement.contentId) ?? []
      );
    }

    const snapshot = normalizeMoneyAmount(order?.purchasePrice);
    if (snapshot != null) {
      prices.set(entitlement.contentId, snapshot);
    }
  }

  return prices;
}

export function resolveApprovedOrderPrice(order: Order): number | null {
  const snapshot = normalizeMoneyAmount(order.purchasePrice);
  if (snapshot != null) {
    return snapshot;
  }

  if (order.contentId == null) {
    return null;
  }

  const item = getContentItemById(order.contentId);
  return normalizePrice(item?.price);
}

export function sumApprovedPurchaseAmounts(orders: Order[]): number {
  const seen = new Set<number>();
  let total = 0;

  for (const order of orders) {
    if (seen.has(order.id)) {
      continue;
    }
    seen.add(order.id);
    total += resolveApprovedOrderPrice(order) ?? 0;
  }

  return total;
}

export function resolveOwnedItemPrice(
  item: { id: number; price?: number | null },
  ownedPrices: Map<number, number>
): number | null {
  const owned = ownedPrices.get(item.id);
  if (owned != null) {
    return owned;
  }
  return normalizePrice(item.price);
}
