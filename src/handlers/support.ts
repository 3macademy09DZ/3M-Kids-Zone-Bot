import type { Context } from "grammy";
import type { Message } from "grammy/types";
import type { EnvConfig } from "../config/env";
import {
  addSupportReply,
  createSupportTicket,
  formatSupportCustomerName,
  getSupportTicketById,
  isSupportTicketOpen,
  supportTicketOwnedBy,
  type SupportTicket,
} from "../database/supportTickets";
import { formatUsernameHandle } from "../database/users";
import { handleHelpMenu } from "./help";
import {
  adminSupportNotifyKeyboard,
  customerSupportReplyCancelKeyboard,
  customerSupportReplyKeyboard,
  supportCancelKeyboard,
  supportDoneKeyboard,
} from "../keyboards/menus";
import { clearAdminContentSession } from "../state/adminContentSession";
import { clearAdminPromoSession } from "../state/adminPromoSession";
import { clearAdminSettingsSession } from "../state/adminSettingsSession";
import { clearAdminSupportReplySession } from "../state/adminSupportSession";
import { clearCheckoutSession } from "../state/checkoutSession";
import { clearPaymentProofSession } from "../state/paymentSession";
import {
  clearSupportSession,
  setSupportSession,
  getSupportSession,
} from "../state/supportSession";
import { formatApprovalDate } from "../utils/orderNumber";
import { logger } from "../utils/logger";

const SUPPORT_PROMPT =
  "🆘 *الدعم والمساعدة*\n\n" +
  "اكتب لنا مشكلتك بالتفصيل، ويمكنك أيضًا إرسال صورة توضح المشكلة.\n" +
  "سيتم إرسال رسالتك إلى إدارة 3M Kids Zone وسنقوم بالرد عليك في أقرب وقت.";

const TELEGRAM_CAPTION_LIMIT = 1024;
const CUSTOMER_CLOSED_TICKET_MESSAGE =
  "✅ هذه التذكرة مغلقة.\n" +
  "إذا احتجت مساعدة جديدة، أنشئ تذكرة جديدة من قسم المساعدة.";

function extractPhotoFileId(message: Message): string | null {
  if (!message.photo?.length) {
    return null;
  }
  return message.photo[message.photo.length - 1]?.file_id ?? null;
}

function buildAdminTicketMessage(ticket: SupportTicket): string {
  const name = [ticket.firstName, ticket.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  const username = formatUsernameHandle(ticket.username) ?? "غير متوفر";
  const problem = ticket.messageText ?? "تم إرسال صورة بدون نص.";

  return (
    "🆘 تذكرة دعم جديدة\n" +
    `🎫 رقم التذكرة: ${ticket.ticketNumber}\n` +
    `👤 العميل: ${name || "غير متوفر"}\n` +
    `🔗 Username: ${username}\n` +
    `🆔 Telegram ID: ${ticket.telegramUserId}\n` +
    `🕒 التاريخ: ${formatApprovalDate(ticket.createdAt)}\n` +
    "📝 المشكلة:\n" +
    problem
  );
}

async function notifyAdminOfTicket(
  ctx: Context,
  config: EnvConfig,
  ticket: SupportTicket
): Promise<void> {
  if (!Number.isInteger(config.adminTelegramId) || config.adminTelegramId <= 0) {
    throw new Error("Invalid admin telegram id");
  }

  const text = buildAdminTicketMessage(ticket);
  const photoFileId = ticket.photoFileId;
  const replyMarkup = adminSupportNotifyKeyboard(ticket.id);

  if (!photoFileId) {
    await ctx.api.sendMessage(config.adminTelegramId, text, {
      reply_markup: replyMarkup,
    });
    return;
  }

  if (text.length <= TELEGRAM_CAPTION_LIMIT) {
    await ctx.api.sendPhoto(config.adminTelegramId, photoFileId, {
      caption: text,
      reply_markup: replyMarkup,
    });
    return;
  }

  await ctx.api.sendPhoto(config.adminTelegramId, photoFileId, {
    caption: `🆘 تذكرة دعم جديدة\n🎫 رقم التذكرة: ${ticket.ticketNumber}`,
  });
  await ctx.api.sendMessage(config.adminTelegramId, text, {
    reply_markup: replyMarkup,
  });
}

async function presentSupportPrompt(ctx: Context): Promise<void> {
  const extra = {
    parse_mode: "Markdown" as const,
    reply_markup: supportCancelKeyboard(),
  };

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(SUPPORT_PROMPT, extra);
      return;
    } catch {
      // Fall through when the previous message cannot be edited.
    }
  }

  await ctx.reply(SUPPORT_PROMPT, extra);
}

export async function handleSupportStart(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }

  await ctx.answerCallbackQuery();
  clearCheckoutSession(userId);
  clearPaymentProofSession(userId);
  clearAdminContentSession(userId);
  clearAdminPromoSession(userId);
  clearAdminSettingsSession(userId);
  clearAdminSupportReplySession(userId);
  setSupportSession(userId, { awaitingMessage: true });
  await presentSupportPrompt(ctx);
}

export async function handleSupportCancel(ctx: Context): Promise<void> {
  if (ctx.from) {
    clearSupportSession(ctx.from.id);
  }
  await handleHelpMenu(ctx);
}

function beginCustomerReplyWait(userId: number, ticketId: number): void {
  clearCheckoutSession(userId);
  clearPaymentProofSession(userId);
  setSupportSession(userId, { awaitingMessage: true, ticketId });
}

async function presentCustomerReplyPrompt(
  ctx: Context,
  ticketNumber: string,
  ticketId: number
): Promise<void> {
  const extra = {
    reply_markup: customerSupportReplyCancelKeyboard(ticketId),
  };
  const text = `اكتب ردك على التذكرة ${ticketNumber}`;

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch {
      // Fall through when the previous message cannot be edited.
    }
  }

  await ctx.reply(text, extra);
}

export async function handleCustomerSupportReplyStart(
  ctx: Context,
  ticketId: number
): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }

  const ticket = getSupportTicketById(ticketId);
  if (!ticket || !supportTicketOwnedBy(ticket, userId)) {
    await ctx.answerCallbackQuery({
      text: "⛔ هذه التذكرة غير متاحة.",
      show_alert: true,
    });
    return;
  }

  if (!isSupportTicketOpen(ticket)) {
    await ctx.answerCallbackQuery();
    clearSupportSession(userId);
    await ctx.reply(CUSTOMER_CLOSED_TICKET_MESSAGE, {
      reply_markup: supportDoneKeyboard(),
    });
    return;
  }

  await ctx.answerCallbackQuery();
  beginCustomerReplyWait(userId, ticket.id);
  await presentCustomerReplyPrompt(ctx, ticket.ticketNumber, ticket.id);
}

function buildAdminCustomerReplyMessage(
  ticket: SupportTicket,
  replyText: string | null
): string {
  const problem = replyText ?? "تم إرسال صورة بدون نص.";
  return (
    "💬 رد جديد من العميل\n" +
    `🎫 التذكرة: ${ticket.ticketNumber}\n` +
    `👤 العميل: ${formatSupportCustomerName(ticket)}\n` +
    "📝 الرد:\n" +
    problem
  );
}

async function notifyAdminOfCustomerReply(
  ctx: Context,
  config: EnvConfig,
  ticket: SupportTicket,
  replyText: string | null,
  photoFileId: string | null
): Promise<void> {
  if (!Number.isInteger(config.adminTelegramId) || config.adminTelegramId <= 0) {
    throw new Error("Invalid admin telegram id");
  }

  const text = buildAdminCustomerReplyMessage(ticket, replyText);
  const replyMarkup = adminSupportNotifyKeyboard(ticket.id);

  if (!photoFileId) {
    await ctx.api.sendMessage(config.adminTelegramId, text, {
      reply_markup: replyMarkup,
    });
    return;
  }

  if (text.length <= TELEGRAM_CAPTION_LIMIT) {
    await ctx.api.sendPhoto(config.adminTelegramId, photoFileId, {
      caption: text,
      reply_markup: replyMarkup,
    });
    return;
  }

  await ctx.api.sendPhoto(config.adminTelegramId, photoFileId, {
    caption: `💬 رد جديد من العميل\n🎫 التذكرة: ${ticket.ticketNumber}`,
  });
  await ctx.api.sendMessage(config.adminTelegramId, text, {
    reply_markup: replyMarkup,
  });
}

async function handleCustomerTicketReplyInput(
  ctx: Context,
  config: EnvConfig,
  userId: number,
  ticketId: number
): Promise<boolean> {
  const ticket = getSupportTicketById(ticketId);
  if (!ticket || !supportTicketOwnedBy(ticket, userId)) {
    clearSupportSession(userId);
    await ctx.reply("⛔ هذه التذكرة غير متاحة.");
    return true;
  }

  if (!isSupportTicketOpen(ticket)) {
    clearSupportSession(userId);
    await ctx.reply(CUSTOMER_CLOSED_TICKET_MESSAGE, {
      reply_markup: supportDoneKeyboard(),
    });
    return true;
  }

  const message = ctx.message;
  if (!message) {
    return true;
  }

  const photoFileId = extractPhotoFileId(message);
  const replyText = (photoFileId ? message.caption : message.text)?.trim() ?? "";

  if (!photoFileId && !replyText) {
    await ctx.reply("❌ يُرجى إرسال رسالة نصية أو صورة.", {
      reply_markup: customerSupportReplyCancelKeyboard(ticket.id),
    });
    return true;
  }

  try {
    await notifyAdminOfCustomerReply(
      ctx,
      config,
      ticket,
      replyText || null,
      photoFileId
    );
  } catch (error) {
    logger.error("Failed to notify admin of customer support reply", error);
    await ctx.reply("❌ تعذّر إرسال الرد إلى الإدارة حالياً. حاول مرة أخرى.", {
      reply_markup: customerSupportReplyCancelKeyboard(ticket.id),
    });
    return true;
  }

  try {
    addSupportReply({
      ticketId: ticket.id,
      sender: "customer",
      messageText: replyText || null,
      photoFileId,
    });
  } catch (error) {
    logger.error("Failed to store customer support reply after sending", error);
  }

  clearSupportSession(userId);
  logger.info("Customer support reply sent to admin");
  await ctx.reply("✅ تم إرسال ردك إلى الإدارة.", {
    reply_markup: customerSupportReplyKeyboard(ticket.id),
  });
  return true;
}

export async function handleSupportTicketInput(
  ctx: Context,
  config: EnvConfig
): Promise<boolean> {
  const user = ctx.from;
  const message = ctx.message;
  if (!user || !message) {
    return false;
  }

  const session = getSupportSession(user.id);
  if (!session) {
    return false;
  }

  if (session.ticketId) {
    return handleCustomerTicketReplyInput(ctx, config, user.id, session.ticketId);
  }

  const photoFileId = extractPhotoFileId(message);
  const problemText = (photoFileId ? message.caption : message.text)?.trim() ?? "";

  if (!photoFileId && !problemText) {
    await ctx.reply(
      "❌ يُرجى إرسال رسالة نصية أو صورة توضح المشكلة.",
      { reply_markup: supportCancelKeyboard() }
    );
    return true;
  }

  let ticket: SupportTicket;
  try {
    ticket = createSupportTicket({
      telegramUserId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      messageText: problemText || null,
      photoFileId,
    });
  } catch (error) {
    logger.error("Failed to store support ticket", error);
    await ctx.reply("❌ تعذّر حفظ المشكلة حالياً. حاول مرة أخرى.", {
      reply_markup: supportCancelKeyboard(),
    });
    return true;
  }

  try {
    await notifyAdminOfTicket(ctx, config, ticket);
  } catch (error) {
    logger.error("Failed to notify admin of support ticket", error);
    await ctx.reply(
      "❌ تعذّر إرسال المشكلة إلى الإدارة حالياً. حاول مرة أخرى.",
      { reply_markup: supportCancelKeyboard() }
    );
    return true;
  }

  clearSupportSession(user.id);
  logger.info("Support ticket sent to admin");
  await ctx.reply(
    "✅ تم إرسال مشكلتك إلى إدارة 3M Kids Zone بنجاح.\n" +
      `🎫 رقم التذكرة: ${ticket.ticketNumber}\n` +
      "احتفظ برقم التذكرة للمتابعة.\n" +
      "سيصلك الرد هنا داخل البوت.",
    { reply_markup: supportDoneKeyboard() }
  );
  return true;
}
