import type { Context } from "grammy";
import { isChannelConfigured } from "../config/env";
import type { EnvConfig } from "../config/env";
import {
  getAllOrders,
  getOrdersWithInviteLinks,
  getUniqueCustomerIds,
} from "../database/orders";
import { getProductById } from "../data/products";
import type { InviteLinkService } from "../services/inviteLink";
import {
  adminBackKeyboard,
  adminMenuKeyboard,
} from "../keyboards/menus";
import type { OrderStatus } from "../database/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "⏳ قيد المراجعة",
  confirmed: "✅ مؤكّد",
  invite_sent: "🔗 تم إرسال الرابط",
  completed: "✔️ مكتمل",
  cancelled: "❌ ملغى",
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
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

  const lines = orders.slice(0, 15).map((order) => {
    const product = getProductById(order.productId);
    const productName = product?.nameAr ?? order.productId;
    const username = order.telegramUsername
      ? `@${order.telegramUsername}`
      : `ID:${order.telegramUserId}`;
    return (
      `#${order.id} | ${STATUS_LABELS[order.status]}\n` +
      `👤 ${username} | 📦 ${truncate(productName, 30)}\n` +
      `📅 ${order.createdAt}`
    );
  });

  const text =
    `📦 *الطلبات* (${orders.length})\n\n` +
    lines.join("\n\n") +
    (orders.length > 15 ? `\n\n_… و${orders.length - 15} طلبات أخرى_` : "") +
    "\n\n_إدارة متقدّمة للطلبات — قريباً._";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: adminBackKeyboard(),
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
