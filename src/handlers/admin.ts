import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { isChannelConfigured } from "../config/env";
import type { EnvConfig } from "../config/env";
import {
  approveOrder,
  approvePayment,
  getAllOrders,
  getOrderById,
  getOrdersWithInviteLinks,
  rejectPayment,
} from "../database/orders";
import { getContentItemById } from "../database/content";
import {
  CONTENT_TYPE_EMOJI,
  CONTENT_TYPE_ITEM_LABEL,
} from "../database/contentTypes";
import { getProductById } from "../data/products";
import type { InviteLinkService } from "../services/inviteLink";
import {
  adminBackKeyboard,
  adminEmptyOrderSectionKeyboard,
  adminMenuKeyboard,
  adminOrderKeyboard,
  adminOrdersHubKeyboard,
  adminOrderSectionListKeyboard,
  openMyProductsKeyboard,
} from "../keyboards/menus";
import type { AdminOrderSection, Order, OrderStatus } from "../database/types";
import {
  getAdminOrderSection,
  orderBelongsToAdminSection,
} from "../database/types";
import {
  buildRejectedPaymentMessage,
  PAYMENT_METHOD_LABELS,
} from "./payment";
import { buildPurchaseReceipt, getOrderDisplayNumber } from "../utils/orderNumber";
import { formatPriceDzd } from "../utils/price";
import { logger } from "../utils/logger";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "⏳ قيد المراجعة",
  awaiting_payment: "💳 بانتظار الدفع",
  payment_pending_review: "⏳ بانتظار التحقق من الدفع",
  rejected_payment: "❌ رفض الدفع",
  approved: "✅ تمت الموافقة",
  confirmed: "✅ تمت الموافقة",
  invite_sent: "🔗 تم إرسال الرابط",
  completed: "✔️ مكتمل",
  cancelled: "❌ ملغى",
};

const ADMIN_ORDER_SECTION_TITLES: Record<AdminOrderSection, string> = {
  review: "🔎 في انتظار مراجعة الدفع",
  wait: "⏳ في انتظار الدفع",
  approved: "✅ الطلبات المقبولة",
  rejected: "❌ الطلبات المرفوضة",
  all: "📋 كل الطلبات",
};

const ADMIN_ORDERS_PAGE_SIZE = 8;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getStatusLabel(status: string): string {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "review") {
    return STATUS_LABELS.pending;
  }
  return STATUS_LABELS[normalized as OrderStatus] ?? status;
}

export function getOrderItemLabel(order: Order): {
  emoji: string;
  label: string;
  title: string;
  price: string;
} {
  if (order.contentId == null) {
    return {
      emoji: "🎬",
      label: "العنصر",
      title: "غير محدد",
      price: formatPriceDzd(order.purchasePrice),
    };
  }

  const item = getContentItemById(order.contentId);
  if (!item) {
    return {
      emoji: "🎬",
      label: "العنصر",
      title: `#${order.contentId}`,
      price: formatPriceDzd(order.purchasePrice),
    };
  }

  return {
    emoji: CONTENT_TYPE_EMOJI[item.contentType],
    label: CONTENT_TYPE_ITEM_LABEL[item.contentType],
    title: item.titleAr,
    price: formatPriceDzd(order.purchasePrice ?? item.price),
  };
}

function countOrdersBySection(orders: Order[]): Record<AdminOrderSection, number> {
  const counts: Record<AdminOrderSection, number> = {
    review: 0,
    wait: 0,
    approved: 0,
    rejected: 0,
    all: orders.length,
  };

  for (const order of orders) {
    const section = getAdminOrderSection(order.status);
    if (section) {
      counts[section] += 1;
    }
  }

  return counts;
}

function ordersForSection(orders: Order[], section: AdminOrderSection): Order[] {
  return orders.filter((order) => orderBelongsToAdminSection(order.status, section));
}

function backSectionForOrder(order: Order): AdminOrderSection {
  return getAdminOrderSection(order.status) ?? "all";
}

function buildOrderSummary(order: Order): string {
  const product = getProductById(order.productId);
  const item = getOrderItemLabel(order);
  const customer = order.telegramUsername
    ? `@${order.telegramUsername}`
    : String(order.telegramUserId);
  const productName =
    item.title !== "غير محدد" ? item.title : (product?.nameAr ?? order.productId);

  return (
    `🧾 ${getOrderDisplayNumber(order)}\n` +
    `👤 ${customer}\n` +
    `📦 ${productName}\n` +
    `💰 ${item.price}\n` +
    `📌 ${getStatusLabel(order.status)}`
  );
}

export function buildOrderMessage(order: Order): string {
  const product = getProductById(order.productId);
  const productName = product?.nameAr ?? order.productId;
  const item = getOrderItemLabel(order);
  const username = order.telegramUsername
    ? `@${order.telegramUsername}`
    : "بدون اسم مستخدم";
  const paymentMethod = order.paymentMethod
    ? PAYMENT_METHOD_LABELS[order.paymentMethod]
    : "غير محدد";
  const proofLabel = order.paymentProofFileId ? "مرفق أدناه" : "غير موجود";

  return (
    `📦 <b>طلب ${escapeHtml(getOrderDisplayNumber(order))}</b>\n\n` +
    `📌 الحالة: ${escapeHtml(getStatusLabel(order.status))}\n` +
    `👤 العميل: ${escapeHtml(username)}\n` +
    `🆔 Telegram ID: <code>${order.telegramUserId}</code>\n` +
    `📦 الحزمة: ${escapeHtml(productName)}\n` +
    `${item.emoji} ${escapeHtml(item.label)}: ${escapeHtml(item.title)}\n` +
    `💰 السعر: ${escapeHtml(item.price)}\n` +
    `💳 طريقة الدفع: ${escapeHtml(paymentMethod)}\n` +
    `🧾 إثبات الدفع: ${escapeHtml(proofLabel)}\n` +
    `📅 التاريخ: ${escapeHtml(order.createdAt)}`
  );
}

async function sendPaymentProof(ctx: Context, order: Order): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId || !order.paymentProofFileId) {
    return;
  }

  try {
    if (order.paymentProofMediaKind === "document") {
      await ctx.api.sendDocument(chatId, order.paymentProofFileId, {
        caption: `🧾 إثبات الدفع — ${getOrderDisplayNumber(order)}`,
      });
    } else {
      await ctx.api.sendPhoto(chatId, order.paymentProofFileId, {
        caption: `🧾 إثبات الدفع — ${getOrderDisplayNumber(order)}`,
      });
    }
  } catch (error) {
    logger.error(`Failed to send payment proof for order #${order.id}`, error);
  }
}

function callbackMessageHasMedia(ctx: Context): boolean {
  const message = ctx.callbackQuery?.message;
  if (!message || !("date" in message)) {
    return false;
  }

  return Boolean(
    ("photo" in message && message.photo) ||
      ("document" in message && message.document)
  );
}

async function updateAdminOrderDetailsMessage(
  ctx: Context,
  order: Order,
  backSection: AdminOrderSection
): Promise<void> {
  const keyboard = adminOrderKeyboard(order, backSection);
  const text = buildOrderMessage(order);

  try {
    if (callbackMessageHasMedia(ctx)) {
      await ctx.editMessageCaption({
        caption: text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return;
    }

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } catch (error) {
    logger.error(`Failed to refresh admin order #${order.id} view`, error);
  }
}

async function presentAdminText(
  ctx: Context,
  text: string,
  extra: {
    parse_mode?: "Markdown" | "HTML";
    reply_markup?: InlineKeyboard;
  }
): Promise<void> {
  if (callbackMessageHasMedia(ctx)) {
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    } catch {
      // The proof image can stay; list/hub continue in a new message.
    }
    await ctx.reply(text, extra);
    return;
  }

  await ctx.editMessageText(text, extra);
}

async function showAdminOrderDetails(
  ctx: Context,
  order: Order,
  backSection: AdminOrderSection
): Promise<void> {
  await updateAdminOrderDetailsMessage(ctx, order, backSection);

  if (!callbackMessageHasMedia(ctx)) {
    await sendPaymentProof(ctx, order);
  }
}

export async function handleAdminCommand(ctx: Context): Promise<void> {
  await ctx.reply("🔐 *لوحة الإدارة — 3M Kids Zone*", {
    parse_mode: "Markdown",
    reply_markup: adminMenuKeyboard(),
  });
}

export async function handleAdminBack(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("🔐 *لوحة الإدارة — 3M Kids Zone*", {
    parse_mode: "Markdown",
    reply_markup: adminMenuKeyboard(),
  });
}

export async function handleAdminOrders(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const counts = countOrdersBySection(getAllOrders());

  await presentAdminText(ctx, "📦 *الطلبات*\n\nاختر القسم الذي تريد عرضه:", {
    parse_mode: "Markdown",
    reply_markup: adminOrdersHubKeyboard(counts),
  });
}

export async function handleAdminOrderSection(
  ctx: Context,
  section: AdminOrderSection,
  page = 0
): Promise<void> {
  await ctx.answerCallbackQuery();

  const orders = ordersForSection(getAllOrders(), section);
  const title = ADMIN_ORDER_SECTION_TITLES[section];

  if (orders.length === 0) {
    await presentAdminText(
      ctx,
      `${title}\n\nلا توجد طلبات في هذا القسم حاليًا.`,
      {
        reply_markup: adminEmptyOrderSectionKeyboard(),
      }
    );
    return;
  }

  const totalPages = Math.max(1, Math.ceil(orders.length / ADMIN_ORDERS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const slice = orders.slice(
    safePage * ADMIN_ORDERS_PAGE_SIZE,
    (safePage + 1) * ADMIN_ORDERS_PAGE_SIZE
  );

  const pageNote =
    totalPages > 1 ? `\n\nصفحة ${safePage + 1} من ${totalPages}` : "";

  await presentAdminText(
    ctx,
    `${title} (${orders.length})\n\n` +
      slice.map(buildOrderSummary).join("\n\n") +
      pageNote,
    {
      reply_markup: adminOrderSectionListKeyboard({
        section,
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

export async function handleAdminOrderView(
  ctx: Context,
  orderId: number,
  backSection: AdminOrderSection
): Promise<void> {
  const order = getOrderById(orderId);
  if (!order) {
    await ctx.answerCallbackQuery({
      text: "❌ الطلب غير موجود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  await showAdminOrderDetails(ctx, order, backSection);
}

export async function handleAdminApproveOrder(
  ctx: Context,
  orderId: number
): Promise<void> {
  const result = approveOrder(orderId);

  if (!result.ok) {
    await ctx.answerCallbackQuery({
      text:
        result.reason === "not_found"
          ? "❌ الطلب غير موجود."
          : "❌ لا يمكن قبول هذا الطلب.",
      show_alert: true,
    });
    return;
  }

  if (result.alreadyApproved) {
    await ctx.answerCallbackQuery({
      text: "ℹ️ تم قبول هذا الطلب مسبقاً.",
      show_alert: true,
    });
  } else {
    await ctx.answerCallbackQuery({ text: "✅ تم قبول الطلب." });

    try {
      await ctx.api.sendMessage(
        result.order.telegramUserId,
        "✅ تم تأكيد الدفع والموافقة على طلبك\n" +
          "أصبح المحتوى متاحًا الآن",
        {
          reply_markup: openMyProductsKeyboard(),
        }
      );
    } catch (error) {
      logger.error(
        `Failed to notify customer ${result.order.telegramUserId} about approval`,
        error
      );
    }
  }

  const order = getOrderById(orderId) ?? result.order;
  await updateAdminOrderDetailsMessage(ctx, order, backSectionForOrder(order));
}

export async function handleAdminAcceptPayment(
  ctx: Context,
  orderId: number
): Promise<void> {
  const result = approvePayment(orderId);

  if (!result.ok) {
    await ctx.answerCallbackQuery({
      text:
        result.reason === "missing_proof"
          ? "❌ لا يوجد إثبات دفع. استخدم القبول اليدوي إن لزم."
          : result.reason === "not_found"
            ? "❌ الطلب غير موجود."
            : "❌ لا يمكن قبول هذا الدفع.",
      show_alert: true,
    });
    return;
  }

  if (result.alreadyApproved) {
    await ctx.answerCallbackQuery({
      text: "ℹ️ تم قبول هذا الطلب مسبقاً.",
      show_alert: true,
    });
  } else {
    await ctx.answerCallbackQuery({ text: "✅ تم قبول الدفع." });

    try {
      const item = getOrderItemLabel(result.order);
      await ctx.api.sendMessage(
        result.order.telegramUserId,
        buildPurchaseReceipt({
          order: result.order,
          productName: item.title,
          priceLabel: item.price,
        }),
        {
          reply_markup: openMyProductsKeyboard(),
        }
      );
    } catch (error) {
      logger.error(
        `Failed to notify customer ${result.order.telegramUserId} about payment approval`,
        error
      );
    }
  }

  const order = getOrderById(orderId) ?? result.order;
  await updateAdminOrderDetailsMessage(ctx, order, backSectionForOrder(order));
}

export async function handleAdminRejectPayment(
  ctx: Context,
  orderId: number,
  config: EnvConfig
): Promise<void> {
  const result = rejectPayment(orderId);

  if (!result.ok) {
    await ctx.answerCallbackQuery({
      text:
        result.reason === "not_found"
          ? "❌ الطلب غير موجود."
          : "❌ لا يمكن رفض هذا الدفع.",
      show_alert: true,
    });
    return;
  }

  if (result.alreadyApproved) {
    await ctx.answerCallbackQuery({
      text: "ℹ️ هذا الطلب مقبول مسبقاً ولا يمكن رفضه.",
      show_alert: true,
    });
  } else {
    await ctx.answerCallbackQuery({ text: "❌ تم رفض الدفع." });

    try {
      const rejected = buildRejectedPaymentMessage(config, result.order.id);
      await ctx.api.sendMessage(result.order.telegramUserId, rejected.text, {
        reply_markup: rejected.keyboard,
      });
    } catch (error) {
      logger.error(
        `Failed to notify customer ${result.order.telegramUserId} about payment rejection`,
        error
      );
    }
  }

  const order = getOrderById(orderId) ?? result.order;
  await updateAdminOrderDetailsMessage(ctx, order, backSectionForOrder(order));
}

export async function handleAdminInvites(
  ctx: Context,
  inviteLinkService: InviteLinkService
): Promise<void> {
  await ctx.answerCallbackQuery();

  const statusMessage = inviteLinkService.getStatusMessage();
  const ordersWithLinks = getOrdersWithInviteLinks();

  let text = `🔗 *روابط الدعوة*\n\n${statusMessage}`;

  if (ordersWithLinks.length > 0) {
    const lines = ordersWithLinks.slice(0, 10).map((order) => {
      return (
        `• \`${order.inviteLinkName ?? "—"}\` — طلب #${order.id}\n` +
        `  ${order.inviteLink ? truncate(order.inviteLink, 40) : "—"}`
      );
    });
    text +=
      `\n\n*الروابط المُنشأة:*\n` +
      lines.join("\n") +
      (ordersWithLinks.length > 10
        ? `\n\n_… و${ordersWithLinks.length - 10} رابط آخر_`
        : "");
  }

  text += "\n\n_إنشاء روابط دعوة تلقائياً — قريباً._";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: adminBackKeyboard(),
  });
}

export async function handleAdminSettings(
  ctx: Context,
  config: EnvConfig,
  inviteLinkService: InviteLinkService
): Promise<void> {
  await ctx.answerCallbackQuery();

  const channelStatus = isChannelConfigured(config.channelId)
    ? "✅ مُعدّ"
    : "❌ غير مُعدّ";
  const contactStatus = config.contactUsername ? "✅ مُعدّ" : "❌ غير مُعدّ";
  const inviteStatus = inviteLinkService.isReady() ? "✅ جاهز" : "⚠️ غير جاهز";
  const ccpStatus =
    config.ccpAccountInfo || config.baridimobRip || config.paymentAccountName
      ? "✅ مُعدّ"
      : "❌ غير مُعدّ";
  const redotStatus = config.redotpayPaymentInfo ? "✅ مُعدّ" : "❌ غير مُعدّ";

  const text =
    "⚙️ *الإعدادات*\n\n" +
    `📢 القناة (CHANNEL_ID): ${channelStatus}\n` +
    `📞 التواصل (CONTACT_USERNAME): ${contactStatus}\n` +
    `🔗 روابط الدعوة: ${inviteStatus}\n` +
    `💳 CCP / BaridiMob: ${ccpStatus}\n` +
    `💳 RedotPay: ${redotStatus}\n` +
    `👤 المسؤول: \`${config.adminTelegramId}\`\n\n` +
    "_تعديل الإعدادات من ملف .env — قريباً: لوحة إعدادات داخل البوت._";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: adminBackKeyboard(),
  });
}
