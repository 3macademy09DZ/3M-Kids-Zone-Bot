import type { Context } from "grammy";
import type { Message, User } from "grammy/types";
import type { EnvConfig } from "../config/env";
import { formatContactLink } from "../config/env";
import { getContentItemById } from "../database/content";
import { CONTENT_TYPE_EMOJI } from "../database/contentTypes";
import {
  getOrderById,
  setOrderPaymentMethod,
  submitOrderPaymentProof,
} from "../database/orders";
import type { Order, PaymentMethod } from "../database/types";
import { getProductById } from "../data/products";
import {
  adminPaymentProofNotifyKeyboard,
  backToMainKeyboard,
  paymentMethodKeyboard,
  resubmitPaymentKeyboard,
} from "../keyboards/menus";
import {
  clearPaymentProofSession,
  getPaymentProofSession,
  setPaymentProofSession,
} from "../state/paymentSession";
import {
  formatApprovalDate,
  formatPaymentMethodName,
  getOrderDisplayNumber,
} from "../utils/orderNumber";
import { formatPriceDzd } from "../utils/price";
import { logger } from "../utils/logger";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ccp: "💳 CCP / BaridiMob",
  redotpay: "💳 RedotPay",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function parseCcpAccountInfo(
  raw: string
): { number: string; cle: string } | null {
  const match = raw
    .trim()
    .match(/^(\d+)\s*(?:clé|cle|key)\s*[:\-–]?\s*(\d+)$/i);
  if (!match) {
    return null;
  }
  return { number: match[1], cle: match[2] };
}

function formatCcpAccountBlock(raw: string | undefined): string {
  if (!raw) {
    return "🏦 <b>CCP</b>\nغير مُعدّ";
  }

  const parsed = parseCcpAccountInfo(raw);
  if (!parsed) {
    return `🏦 <b>CCP</b>\n<code>${escapeHtml(raw)}</code>`;
  }

  return (
    "🏦 <b>CCP</b>\n" +
    "رقم CCP:\n" +
    `<code>${escapeHtml(parsed.number)}</code>\n` +
    "Clé:\n" +
    `<code>${escapeHtml(parsed.cle)}</code>`
  );
}

function buildCcpPaymentInfo(config: EnvConfig): string {
  const name = config.paymentAccountName ?? "غير مُعدّ";
  const rip = config.baridimobRip ?? "غير مُعدّ";

  return (
    "💳 <b>الدفع عبر CCP / BaridiMob</b>\n\n" +
    `${formatCcpAccountBlock(config.ccpAccountInfo)}\n` +
    `👤 صاحب الحساب:\n${escapeHtml(name)}\n` +
    `🔢 RIP: ${escapeHtml(rip)}\n\n` +
    "بعد التحويل، أرسل الآن <b>صورة إثبات الدفع</b> (Screenshot)."
  );
}

function buildRedotPayInfo(config: EnvConfig): string {
  const info = config.redotpayPaymentInfo ?? "غير مُعدّ";
  return (
    "💳 <b>الدفع عبر RedotPay</b>\n\n" +
    `${escapeHtml(info)}\n\n` +
    "بعد التحويل، أرسل الآن <b>صورة إثبات الدفع</b> (Screenshot)."
  );
}

export function buildPaymentInstructions(
  method: PaymentMethod,
  config: EnvConfig
): string {
  return method === "ccp"
    ? buildCcpPaymentInfo(config)
    : buildRedotPayInfo(config);
}

function extractProofFromMessage(
  message: Message
): { fileId: string; mediaKind: "photo" | "document" } | null {
  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    return { fileId: photo.file_id, mediaKind: "photo" };
  }

  const mime = message.document?.mime_type?.toLowerCase() ?? "";
  if (message.document && mime.startsWith("image/")) {
    return {
      fileId: message.document.file_id,
      mediaKind: "document",
    };
  }

  return null;
}

export async function handleSelectPaymentMethod(
  ctx: Context,
  orderId: number,
  method: PaymentMethod,
  config: EnvConfig
): Promise<void> {
  const user = ctx.from;
  const order = getOrderById(orderId);

  if (!user || !order || order.telegramUserId !== user.id) {
    await ctx.answerCallbackQuery({
      text: "⛔ هذا الطلب غير متاح.",
      show_alert: true,
    });
    return;
  }

  if (
    order.status !== "awaiting_payment" &&
    order.status !== "rejected_payment"
  ) {
    await ctx.answerCallbackQuery({
      text: "ℹ️ لا يمكن تغيير طريقة الدفع لهذا الطلب.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  setOrderPaymentMethod(orderId, method);
  setPaymentProofSession(user.id, { orderId });

  await ctx.editMessageText(buildPaymentInstructions(method, config), {
    parse_mode: "HTML",
    reply_markup: backToMainKeyboard(),
  });
}

export async function handleResubmitPayment(
  ctx: Context,
  orderId: number,
  config: EnvConfig
): Promise<void> {
  const user = ctx.from;
  const order = getOrderById(orderId);

  if (!user || !order || order.telegramUserId !== user.id) {
    await ctx.answerCallbackQuery({
      text: "⛔ هذا الطلب غير متاح.",
      show_alert: true,
    });
    return;
  }

  if (order.status !== "rejected_payment") {
    await ctx.answerCallbackQuery({
      text: "ℹ️ لا يمكن إعادة إرسال الإثبات لهذا الطلب.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  if (!order.paymentMethod) {
    await ctx.editMessageText(
      "📤 *إعادة إرسال إثبات الدفع*\n\nاختر طريقة الدفع أولًا:",
      {
        parse_mode: "Markdown",
        reply_markup: paymentMethodKeyboard(order.id),
      }
    );
    return;
  }

  setPaymentProofSession(user.id, { orderId });
  await ctx.editMessageText(
    buildPaymentInstructions(order.paymentMethod, config),
    {
      parse_mode: "HTML",
      reply_markup: backToMainKeyboard(),
    }
  );
}

function formatCustomerDisplayName(user: User | undefined, order: Order): string {
  const fullName = [user?.first_name, user?.last_name]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  const username = order.telegramUsername
    ? `@${order.telegramUsername}`
    : user?.username
      ? `@${user.username}`
      : null;

  if (fullName && username) {
    return `${fullName} (${username})`;
  }
  if (fullName) {
    return fullName;
  }
  if (username) {
    return username;
  }
  return "غير متوفر";
}

function buildAdminPaymentProofCaption(order: Order, user: User | undefined): string {
  const item = order.contentId ? getContentItemById(order.contentId) : null;
  const product = getProductById(order.productId);
  const productName = item?.titleAr ?? product?.nameAr ?? order.productId;
  const price = formatPriceDzd(order.purchasePrice ?? item?.price ?? null);

  return (
    "🔔 إثبات دفع جديد\n" +
    `🧾 رقم الطلب: ${getOrderDisplayNumber(order)}\n` +
    `👤 العميل: ${formatCustomerDisplayName(user, order)}\n` +
    `🆔 Telegram ID: ${order.telegramUserId}\n` +
    `📦 المنتج: ${productName}\n` +
    `💰 السعر: ${price}\n` +
    `💳 طريقة الدفع: ${formatPaymentMethodName(order.paymentMethod)}\n` +
    "📌 الحالة: 🔎 في انتظار مراجعة الدفع\n" +
    `📅 تاريخ إرسال الإثبات: ${formatApprovalDate(order.paymentSubmittedAt)}`
  );
}

async function notifyAdminOfPaymentProof(
  ctx: Context,
  config: EnvConfig,
  order: Order
): Promise<void> {
  if (!Number.isInteger(config.adminTelegramId) || config.adminTelegramId <= 0) {
    logger.error("Skipping admin payment-proof notify: invalid admin id");
    return;
  }

  const fileId = order.paymentProofFileId;
  if (!fileId) {
    logger.error(
      `Skipping admin payment-proof notify: order #${order.id} has no proof file_id`
    );
    return;
  }

  const options = {
    caption: buildAdminPaymentProofCaption(order, ctx.from),
    reply_markup: adminPaymentProofNotifyKeyboard(order.id),
  };

  if (order.paymentProofMediaKind === "document") {
    await ctx.api.sendDocument(config.adminTelegramId, fileId, options);
  } else {
    await ctx.api.sendPhoto(config.adminTelegramId, fileId, options);
  }
}

export async function handleCustomerPaymentProof(
  ctx: Context,
  config: EnvConfig
): Promise<boolean> {
  const user = ctx.from;
  const message = ctx.message;
  if (!user || !message) {
    return false;
  }

  const session = getPaymentProofSession(user.id);
  if (!session) {
    return false;
  }

  const order = getOrderById(session.orderId);
  if (
    !order ||
    order.telegramUserId !== user.id ||
    (order.status !== "awaiting_payment" && order.status !== "rejected_payment")
  ) {
    clearPaymentProofSession(user.id);
    return false;
  }

  const proof = extractProofFromMessage(message);
  if (!proof) {
    await ctx.reply(
      "❌ يُرجى إرسال *صورة* إثبات الدفع (Screenshot).",
      { parse_mode: "Markdown" }
    );
    return true;
  }

  const updated = submitOrderPaymentProof(
    order.id,
    proof.fileId,
    proof.mediaKind
  );
  clearPaymentProofSession(user.id);

  if (!updated) {
    await ctx.reply("❌ تعذّر حفظ إثبات الدفع. حاول مرة أخرى.");
    return true;
  }

  const item = updated.contentId ? getContentItemById(updated.contentId) : null;
  const product = getProductById(updated.productId);

  logger.info(`Payment proof received for order #${updated.id} from user ${user.id}`);

  await ctx.reply(
    "✅ تم استلام إثبات الدفع\n" +
      "⏳ طلبك الآن قيد المراجعة\n" +
      "سيتم إشعارك بعد التحقق من الدفع.\n\n" +
      `🧾 رقم الطلب: ${getOrderDisplayNumber(updated)}\n` +
      `📦 ${product?.nameAr ?? updated.productId}\n` +
      (item
        ? `${CONTENT_TYPE_EMOJI[item.contentType]} ${item.titleAr}\n` +
          `💰 ${formatPriceDzd(updated.purchasePrice ?? item.price)}`
        : ""),
    { reply_markup: backToMainKeyboard() }
  );

  try {
    await notifyAdminOfPaymentProof(ctx, config, updated);
  } catch (error) {
    logger.error(
      `Failed to notify admin about payment proof for order #${updated.id}`,
      error
    );
  }

  return true;
}

export function buildRejectedPaymentMessage(
  config: EnvConfig,
  orderId: number
): { text: string; keyboard: ReturnType<typeof resubmitPaymentKeyboard> } {
  const contactLink = formatContactLink(config.contactUsername);
  let text =
    "❌ لم يتم قبول إثبات الدفع.\n\n" +
    "يمكنك إعادة إرسال إثبات أوضح، أو التواصل معنا للمساعدة.";

  if (contactLink && config.contactUsername) {
    const display = config.contactUsername.startsWith("@")
      ? config.contactUsername
      : `@${config.contactUsername}`;
    text += `\n\n📞 ${display}`;
  }

  return { text, keyboard: resubmitPaymentKeyboard(orderId) };
}
