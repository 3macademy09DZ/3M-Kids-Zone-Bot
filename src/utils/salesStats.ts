import { getContentItemById } from "../database/content";
import { getAllPurchasedOrders } from "../database/orders";
import type { Order } from "../database/types";
import { CONTENT_TYPE_EMOJI } from "../database/contentTypes";
import { parseStoredDate } from "./orderNumber";
import { sumApprovedPurchaseAmounts } from "./ownedPrice";
import { formatAmountDzd } from "./price";

const ALGIERS_TZ = "Africa/Algiers";

interface AlgiersYmd {
  year: number;
  month: number;
  day: number;
}

export interface BestSellerStats {
  contentId: number;
  title: string;
  salesCount: number;
  revenue: number;
}

export interface SalesStats {
  totalRevenue: number;
  salesCount: number;
  buyerCount: number;
  todaySalesCount: number;
  todayRevenue: number;
  monthSalesCount: number;
  monthRevenue: number;
  bestSeller: BestSellerStats | null;
}

function algiersYmd(date: Date): AlgiersYmd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ALGIERS_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
  };
}

function saleDate(order: Order): Date | null {
  return parseStoredDate(order.paymentReviewedAt) ?? parseStoredDate(order.createdAt);
}

function uniqueOrders(orders: Order[]): Order[] {
  const seen = new Set<number>();
  const unique: Order[] = [];
  for (const order of orders) {
    if (seen.has(order.id)) {
      continue;
    }
    seen.add(order.id);
    unique.push(order);
  }
  return unique;
}

function bestSellerTitle(contentId: number): string {
  const item = getContentItemById(contentId);
  if (!item) {
    return `#${contentId}`;
  }
  return `${CONTENT_TYPE_EMOJI[item.contentType]} ${item.titleAr}`;
}

function isBetterSeller(candidate: BestSellerStats, current: BestSellerStats): boolean {
  if (candidate.salesCount !== current.salesCount) {
    return candidate.salesCount > current.salesCount;
  }
  if (candidate.revenue !== current.revenue) {
    return candidate.revenue > current.revenue;
  }
  return candidate.contentId < current.contentId;
}

export function computeSalesStats(now = new Date()): SalesStats {
  const orders = uniqueOrders(getAllPurchasedOrders());
  const today = algiersYmd(now);

  const buyers = new Set<number>();
  const todayOrders: Order[] = [];
  const monthOrders: Order[] = [];
  const byContent = new Map<number, Order[]>();

  for (const order of orders) {
    buyers.add(order.telegramUserId);

    const soldAt = saleDate(order);
    if (soldAt) {
      const ymd = algiersYmd(soldAt);
      if (ymd.year === today.year && ymd.month === today.month && ymd.day === today.day) {
        todayOrders.push(order);
      }
      if (ymd.year === today.year && ymd.month === today.month) {
        monthOrders.push(order);
      }
    }

    if (order.contentId != null) {
      const list = byContent.get(order.contentId) ?? [];
      list.push(order);
      byContent.set(order.contentId, list);
    }
  }

  let bestSeller: BestSellerStats | null = null;
  for (const [contentId, contentOrders] of byContent) {
    const candidate: BestSellerStats = {
      contentId,
      title: bestSellerTitle(contentId),
      salesCount: contentOrders.length,
      revenue: sumApprovedPurchaseAmounts(contentOrders),
    };
    if (!bestSeller || isBetterSeller(candidate, bestSeller)) {
      bestSeller = candidate;
    }
  }

  return {
    totalRevenue: sumApprovedPurchaseAmounts(orders),
    salesCount: orders.length,
    buyerCount: buyers.size,
    todaySalesCount: todayOrders.length,
    todayRevenue: sumApprovedPurchaseAmounts(todayOrders),
    monthSalesCount: monthOrders.length,
    monthRevenue: sumApprovedPurchaseAmounts(monthOrders),
    bestSeller,
  };
}

export function formatSalesStatsMessage(stats: SalesStats): string {
  const bestSellerBlock = stats.bestSeller
    ? `${stats.bestSeller.title}\n` +
      `🛍️ ${stats.bestSeller.salesCount} مبيعات\n` +
      `💰 ${formatAmountDzd(stats.bestSeller.revenue)}`
    : "لا توجد مبيعات بعد";

  return (
    "📊 إحصائيات المبيعات\n\n" +
    `💰 إجمالي المداخيل: ${formatAmountDzd(stats.totalRevenue)}\n` +
    `🛍️ عدد المبيعات: ${stats.salesCount}\n` +
    `👥 عدد العملاء المشترين: ${stats.buyerCount}\n\n` +
    "📅 اليوم:\n" +
    `🛍️ المبيعات: ${stats.todaySalesCount}\n` +
    `💰 المداخيل: ${formatAmountDzd(stats.todayRevenue)}\n\n` +
    "📆 هذا الشهر:\n" +
    `🛍️ المبيعات: ${stats.monthSalesCount}\n` +
    `💰 المداخيل: ${formatAmountDzd(stats.monthRevenue)}\n\n` +
    "🏆 الأكثر مبيعًا:\n" +
    bestSellerBlock
  );
}
