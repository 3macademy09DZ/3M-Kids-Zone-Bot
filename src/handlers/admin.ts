import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { isChannelConfigured } from "../config/env";
import type { EnvConfig } from "../config/env";
import {
  approveOrder,
  getAllOrders,
  getOrderById,
  getOrdersWithInviteLinks,
  getUniqueCustomerIds,
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
  adminMenuKeyboard,
  adminOrderKeyboard,
  buildApproveOrderCallback,
  openMyProductsKeyboard,
} from "../keyboards/menus";
import type { Order, OrderStatus } from "../database/types";
import { isPendingOrderStatus } from "../database/types";
import { formatPriceDzd } from "../utils/price";
import { logger } from "../utils/logger";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "⏳ قيد المراجعة",
  confirmed: "✅ تمت الموافقة",
  invite_sent: "🔗 تم إرسال الرابط",
  completed: "✔️ مكتمل",
  cancelled: "❌ ملغى",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getStatusLabel(status: string): string {
  const normalized = String(status).trim().toLowerCase();
  if (normalized === "review") {
    return STATUS_LABELS.pending;
  }
  return STATUS_LABELS[normalized as OrderStatus] ?? status;
}

function getOrderItemLabel(order: Order): {
  emoji: string;
  label: string;
  title: string;
  price: string;
} {
  if (order.contentId == null) {
    return { emoji: "🎬", label: "العنصر", title: "غير محدد", price: "غير محدد" };
  }

  const item = getContentItemById(order.contentId);
  if (!item) {
    return {
      emoji: "🎬",
      label: "العنصر",
      title: `#${order.contentId}`,
      price: "غير محدد",
    };
  }

  return {
    emoji: CONTENT_TYPE_EMOJI[item.contentType],
    label: CONTENT_TYPE_ITEM_LABEL[item.contentType],
    title: item.titleAr,
    price: formatPriceDzd(item.price),
  };
}

export function buildOrderMessage(order: Order): string {
  const product = getProductById(order.productId);
  const productName = product?.nameAr ?? order.productId;
  const item = getOrderItemLabel(order);
  const username = order.telegramUsername
    ? `@${order.telegramUsername}`
    : `ID:${order.telegramUserId}`;

  return (
    `📦 <b>طلب #${order.id}</b>\n\n` +
    `📌 الحالة: ${escapeHtml(getStatusLabel(order.status))}\n` +
    `👤 العميل: ${escapeHtml(username)}\n` +
    `📦 الحزمة: ${escapeHtml(productName)}\n` +
    `${item.emoji} ${escapeHtml(item.label)}: ${escapeHtml(item.title)}\n` +
    `💰 السعر: ${escapeHtml(item.price)}\n` +
    `📅 التاريخ: ${escapeHtml(order.createdAt)}`
  );
}

async function sendOrderMessage(ctx: Context, order: Order): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    logger.error("Cannot send order message: chat id is missing");
    return;
  }

  const replyMarkup = isPendingOrderStatus(order.status)
    ? {
        inline_keyboard: [
          [
            {
              text: "✅ قبول الطلب",
              callback_data: buildApproveOrderCallback(order.id),
            },
          ],
        ],
      }
    : undefined;

  await ctx.api.sendMessage(chatId, buildOrderMessage(order), {
    parse_mode: "HTML",
    reply_markup: replyMarkup,
  });
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
  const orders = getAllOrders();

  if (orders.length === 0) {
    await ctx.editMessageText("📦 *الطلبات*\n\nلا توجد طلبات حالياً.", {
      parse_mode: "Markdown",
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  const pendingOrders = orders.filter((order) =>
    isPendingOrderStatus(order.status)
  );

  await ctx.editMessageText(
    `📦 *الطلبات* (${orders.length})\n\n` +
      (pendingOrders.length > 0
        ? `_يوجد ${pendingOrders.length} طلب/طلبات بانتظار الموافقة._\n\n`
        : "") +
      "_يتم عرض الطلبات في الرسائل التالية:_",
    {
      parse_mode: "Markdown",
      reply_markup: adminBackKeyboard(),
    }
  );

  const pendingFirst = [
    ...orders.filter((order) => isPendingOrderStatus(order.status)),
    ...orders.filter((order) => !isPendingOrderStatus(order.status)),
  ];

  for (const order of pendingFirst.slice(0, 20)) {
    try {
      await sendOrderMessage(ctx, order);
    } catch (error) {
      logger.error(`Failed to send order message for order #${order.id}`, error);
    }
  }
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
      const approvedItem = getOrderItemLabel(result.order);
      await ctx.api.sendMessage(
        result.order.telegramUserId,
        "✅ تمت الموافقة على طلبك\n" +
          `${approvedItem.emoji} أصبح ${approvedItem.label} متاحًا لك الآن`,
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
  const keyboard = adminOrderKeyboard(order);

  await ctx.editMessageText(buildOrderMessage(order), {
    parse_mode: "HTML",
    reply_markup: keyboard.inline_keyboard.length > 0 ? keyboard : new InlineKeyboard(),
  });
}

export async function handleAdminCustomers(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const customerIds = getUniqueCustomerIds();

  if (customerIds.length === 0) {
    await ctx.editMessageText("👥 *العملاء*\n\nلا يوجد عملاء مسجّلون حالياً.", {
      parse_mode: "Markdown",
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  const orders = getAllOrders();
  const lines = customerIds.slice(0, 20).map((id) => {
    const userOrders = orders.filter((o) => o.telegramUserId === id);
    const username = userOrders[0]?.telegramUsername;
    const display = username ? `@${username}` : `ID: ${id}`;
    return `• ${display} — ${userOrders.length} طلب/طلبات`;
  });

  const text =
    `👥 *العملاء* (${customerIds.length})\n\n` +
    lines.join("\n") +
    (customerIds.length > 20
      ? `\n\n_… و${customerIds.length - 20} عميل آخر_`
      : "") +
    "\n\n_إدارة متقدّمة للعملاء — قريباً._";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: adminBackKeyboard(),
  });
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

  const text =
    "⚙️ *الإعدادات*\n\n" +
    `📢 القناة (CHANNEL_ID): ${channelStatus}\n` +
    `📞 التواصل (CONTACT_USERNAME): ${contactStatus}\n` +
    `🔗 روابط الدعوة: ${inviteStatus}\n` +
    `👤 المسؤول: \`${config.adminTelegramId}\`\n\n` +
    "_تعديل الإعدادات من ملف .env — قريباً: لوحة إعدادات داخل البوت._";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: adminBackKeyboard(),
  });
}
