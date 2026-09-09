import { getPurchasedOrdersByUserId } from "../database/orders";
import { getContentItemById } from "../database/content";
import type { ProductContentItem } from "../database/contentTypes";

export function userHasProductAccess(
  telegramUserId: number,
  productId: string
): boolean {
  const orders = getPurchasedOrdersByUserId(telegramUserId);
  return orders.some((order) => order.productId === productId);
}

export function getAccessibleProductIds(telegramUserId: number): string[] {
  const orders = getPurchasedOrdersByUserId(telegramUserId);
  const seen = new Set<string>();
  const productIds: string[] = [];

  for (const order of orders) {
    if (seen.has(order.productId)) continue;
    seen.add(order.productId);
    productIds.push(order.productId);
  }

  return productIds;
}

export function userCanAccessContentItem(
  telegramUserId: number,
  contentItemId: number
): { allowed: boolean; item: ProductContentItem | null } {
  const item = getContentItemById(contentItemId);
  if (!item) {
    return { allowed: false, item: null };
  }

  const allowed = userHasProductAccess(telegramUserId, item.productId);
  return { allowed, item };
}
