import { getContentItemById, getEntitledContentItemsForUser } from "../database/content";
import { userHasVideoEntitlement } from "../database/entitlements";
import {
  isPurchasableContentType,
  type ProductContentItem,
} from "../database/contentTypes";

export function userHasVideoAccess(
  telegramUserId: number,
  contentId: number
): boolean {
  return userHasVideoEntitlement(telegramUserId, contentId);
}

export function getAccessibleVideos(
  telegramUserId: number
): ProductContentItem[] {
  return getEntitledContentItemsForUser(telegramUserId).filter((item) =>
    isPurchasableContentType(item.contentType)
  );
}

export function getAccessibleVideosInProduct(
  telegramUserId: number,
  productId: string
): ProductContentItem[] {
  return getAccessibleVideos(telegramUserId).filter(
    (item) => item.productId === productId
  );
}

export function getAccessibleProductIds(telegramUserId: number): string[] {
  const seen = new Set<string>();
  const productIds: string[] = [];

  for (const item of getAccessibleVideos(telegramUserId)) {
    if (seen.has(item.productId)) continue;
    seen.add(item.productId);
    productIds.push(item.productId);
  }

  return productIds;
}

export function userHasEntitledVideosInProduct(
  telegramUserId: number,
  productId: string
): boolean {
  return getAccessibleVideosInProduct(telegramUserId, productId).length > 0;
}

export function userCanAccessContentItem(
  telegramUserId: number,
  contentItemId: number
): { allowed: boolean; item: ProductContentItem | null } {
  const item = getContentItemById(contentItemId);
  if (!item) {
    return { allowed: false, item: null };
  }

  const allowed = userHasVideoAccess(telegramUserId, item.id);
  return { allowed, item: allowed ? item : null };
}
