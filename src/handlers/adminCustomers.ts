import type { Context } from "grammy";
import { getEntitledContentItemsForUser } from "../database/content";
import { CONTENT_TYPE_EMOJI, type ProductContentItem } from "../database/contentTypes";
import { getEntitlementsByUserId } from "../database/entitlements";
import {
  getAllOrders,
  getOrdersByUserId,
  getPurchasedOrdersByUserId,
} from "../database/orders";
import type { Order } from "../database/types";
import { getAdminOrderSection } from "../database/types";
import {
  formatUserDisplayName,
  formatUsernameHandle,
  getTelegramUserById,
  getTelegramUsersByIds,
} from "../database/users";
import {
  adminBackKeyboard,
  adminCustomerCardKeyboard,
  adminCustomerOrdersKeyboard,
  adminCustomerProductsKeyboard,
  adminCustomersListKeyboard,
} from "../keyboards/menus";
import { getOrderItemLabel, getStatusLabel } from "./admin";
import { getOrderDisplayNumber, formatApprovalDate } from "../utils/orderNumber";
import {
  getOwnedContentPriceMap,
  resolveOwnedItemPrice,
  sumApprovedPurchaseAmounts,
} from "../utils/ownedPrice";
import { formatPriceDzd } from "../utils/price";

const CUSTOMERS_PAGE_SIZE = 10;
const CUSTOMER_ORDERS_PAGE_SIZE = 10;

interface CustomerListEntry {
  telegramUserId: number;
  username: string | null;
  approvedCount: number;
  lastOrderId: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPurchaseTotal(total: number): string {
  if (!Number.isFinite(total) || total <= 0) {
    return "0 دج";
  }
  return formatPriceDzd(total);
}

function buildCustomerEntries(): CustomerListEntry[] {
  const byUser = new Map<number, CustomerListEntry>();

  for (const order of getAllOrders()) {
    const existing = byUser.get(order.telegramUserId);
    if (!existing) {
      byUser.set(order.telegramUserId, {
        telegramUserId: order.telegramUserId,
        username: order.telegramUsername,
        approvedCount: getAdminOrderSection(order.status) === "approved" ? 1 : 0,
        lastOrderId: order.id,
      });
      continue;
    }

    if (order.id > existing.lastOrderId) {
      existing.lastOrderId = order.id;
      if (order.telegramUsername) {
        existing.username = order.telegramUsername;
      }
    } else if (!existing.username && order.telegramUsername) {
      existing.username = order.telegramUsername;
    }

    if (getAdminOrderSection(order.status) === "approved") {
      existing.approvedCount += 1;
    }
  }

  return [...byUser.values()].sort((a, b) => b.lastOrderId - a.lastOrderId);
}

function paginate<T>(items: T[], page: number, pageSize: number): {
  slice: T[];
  page: number;
  totalPages: number;
} {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const slice = items.slice(safePage * pageSize, (safePage + 1) * pageSize);
  return { slice, page: safePage, totalPages };
}

function countByBucket(orders: Order[]): {
  approved: number;
  incomplete: number;
  rejected: number;
} {
  let approved = 0;
  let incomplete = 0;
  let rejected = 0;

  for (const order of orders) {
    const section = getAdminOrderSection(order.status);
    if (section === "approved") {
      approved += 1;
    } else if (section === "wait" || section === "review") {
      incomplete += 1;
    } else if (section === "rejected") {
      rejected += 1;
    }
  }

  return { approved, incomplete, rejected };
}

function latestActivityLabel(orders: Order[]): string {
  if (orders.length === 0) {
    return "غير متوفر";
  }

  const latest = [...orders].sort((a, b) => b.id - a.id)[0];
  return formatApprovalDate(
    latest.paymentReviewedAt ?? latest.paymentSubmittedAt ?? latest.createdAt
  );
}

function formatPurchasedProductLine(
  item: ProductContentItem,
  ownedPrices: Map<number, number>
): string {
  const price = formatPriceDzd(resolveOwnedItemPrice(item, ownedPrices));
  return (
    `${CONTENT_TYPE_EMOJI[item.contentType]} ${item.titleAr}\n` +
    `💰 ${price}`
  );
}

function buildCustomerOrderSummary(order: Order): string {
  const item = getOrderItemLabel(order);
  return (
    `🧾 ${getOrderDisplayNumber(order)}\n` +
    `📦 ${item.title}\n` +
    `💰 ${item.price}\n` +
    `📌 ${getStatusLabel(order.status)}`
  );
}

export async function handleAdminCustomers(
  ctx: Context,
  page = 0
): Promise<void> {
  await ctx.answerCallbackQuery();

  const customers = buildCustomerEntries();
  if (customers.length === 0) {
    await ctx.editMessageText("👥 العملاء\n\nلا يوجد عملاء مسجّلون حالياً.", {
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  const { slice, page: safePage, totalPages } = paginate(
    customers,
    page,
    CUSTOMERS_PAGE_SIZE
  );
  const profiles = getTelegramUsersByIds(
    slice.map((customer) => customer.telegramUserId)
  );

  const lines = slice.map((customer) => {
    const name = formatUserDisplayName(
      profiles.get(customer.telegramUserId),
      customer.telegramUserId,
      customer.username
    );
    return (
      `👤 ${escapeHtml(name)}\n` +
      `🆔 <code>${customer.telegramUserId}</code>\n` +
      `🛍️ ${customer.approvedCount}`
    );
  });

  const pageNote =
    totalPages > 1 ? `\n\nصفحة ${safePage + 1} من ${totalPages}` : "";

  await ctx.editMessageText(
    `👥 <b>العملاء</b> (${customers.length})\n\n` + lines.join("\n\n") + pageNote,
    {
      parse_mode: "HTML",
      reply_markup: adminCustomersListKeyboard({
        customerIds: slice.map((customer) => customer.telegramUserId),
        page: safePage,
        totalPages,
      }),
    }
  );
}

export async function handleAdminCustomerView(
  ctx: Context,
  telegramUserId: number
): Promise<void> {
  const orders = getOrdersByUserId(telegramUserId);
  if (orders.length === 0) {
    await ctx.answerCallbackQuery({
      text: "❌ لا توجد بيانات لهذا العميل.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const purchasedOrders = getPurchasedOrdersByUserId(telegramUserId);
  const buckets = countByBucket(orders);
  const purchasedItems = getEntitlementsByUserId(telegramUserId).length;
  const profile = getTelegramUserById(telegramUserId);
  const fallbackUsername =
    orders.find((order) => order.telegramUsername)?.telegramUsername ?? null;
  const name = formatUserDisplayName(profile, telegramUserId, fallbackUsername);
  const usernameHandle = formatUsernameHandle(
    profile?.username ?? fallbackUsername
  );
  const totalSpent = sumApprovedPurchaseAmounts(purchasedOrders);

  const usernameLine = usernameHandle
    ? `🔗 Username: ${escapeHtml(usernameHandle)}\n`
    : "";

  const text =
    "👤 <b>بطاقة العميل</b>\n\n" +
    `👤 العميل: ${escapeHtml(name)}\n` +
    usernameLine +
    `🆔 Telegram ID: <code>${telegramUserId}</code>\n` +
    `📦 عدد المنتجات المشتراة: ${purchasedItems}\n` +
    `🧾 إجمالي الطلبات: ${orders.length}\n` +
    `✅ الطلبات المقبولة: ${buckets.approved}\n` +
    `⏳ الطلبات غير المكتملة/المنتظرة: ${buckets.incomplete}\n` +
    `❌ الطلبات المرفوضة: ${buckets.rejected}\n` +
    `💰 مجموع المشتريات: ${escapeHtml(formatPurchaseTotal(totalSpent))}\n` +
    `📅 آخر نشاط/طلب: ${escapeHtml(latestActivityLabel(orders))}`;

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: adminCustomerCardKeyboard({
      telegramUserId,
      purchasedCount: purchasedItems,
    }),
  });
}

export async function handleAdminCustomerProducts(
  ctx: Context,
  telegramUserId: number
): Promise<void> {
  await ctx.answerCallbackQuery();

  const items = getEntitledContentItemsForUser(telegramUserId);
  const ownedPrices = getOwnedContentPriceMap(telegramUserId);
  const title = `📦 المنتجات المشتراة (${items.length})`;

  if (items.length === 0) {
    await ctx.editMessageText(
      `${title}\n\nلا توجد منتجات مشتراة حالياً.`,
      {
        reply_markup: adminCustomerProductsKeyboard(telegramUserId),
      }
    );
    return;
  }

  const lines = items.map((item) => formatPurchasedProductLine(item, ownedPrices));

  await ctx.editMessageText(`${title}\n\n${lines.join("\n\n")}`, {
    reply_markup: adminCustomerProductsKeyboard(telegramUserId),
  });
}

export async function handleAdminCustomerOrders(
  ctx: Context,
  telegramUserId: number,
  page = 0
): Promise<void> {
  await ctx.answerCallbackQuery();

  const orders = getOrdersByUserId(telegramUserId);
  if (orders.length === 0) {
    await ctx.editMessageText("🧾 طلبات العميل\n\nلا توجد طلبات حالياً. (0)", {
      reply_markup: adminCustomerProductsKeyboard(telegramUserId),
    });
    return;
  }

  const { slice, page: safePage, totalPages } = paginate(
    orders,
    page,
    CUSTOMER_ORDERS_PAGE_SIZE
  );

  const pageNote =
    totalPages > 1 ? `\n\nصفحة ${safePage + 1} من ${totalPages}` : "";

  await ctx.editMessageText(
    `🧾 طلبات العميل (${orders.length})\n\n` +
      slice.map(buildCustomerOrderSummary).join("\n\n") +
      pageNote,
    {
      reply_markup: adminCustomerOrdersKeyboard({
        telegramUserId,
        orders: slice.map((order) => ({
          id: order.id,
          displayNumber: getOrderDisplayNumber(order),
        })),
        page: safePage,
        totalPages,
      }),
    }
  );
}
