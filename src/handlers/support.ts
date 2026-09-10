import type { Context } from "grammy";
import type { Message } from "grammy/types";
import type { EnvConfig } from "../config/env";
import {
  createSupportTicket,
  type SupportTicket,
} from "../database/supportTickets";
import { formatUsernameHandle } from "../database/users";
import { handleHelpMenu } from "./help";
import {
  supportCancelKeyboard,
  supportDoneKeyboard,
} from "../keyboards/menus";
import { clearAdminContentSession } from "../state/adminContentSession";
import { clearAdminPromoSession } from "../state/adminPromoSession";
import { clearAdminSettingsSession } from "../state/adminSettingsSession";
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

  if (!photoFileId) {
    await ctx.api.sendMessage(config.adminTelegramId, text);
    return;
  }

  if (text.length <= TELEGRAM_CAPTION_LIMIT) {
    await ctx.api.sendPhoto(config.adminTelegramId, photoFileId, {
      caption: text,
    });
    return;
  }

  await ctx.api.sendPhoto(config.adminTelegramId, photoFileId, {
    caption: `🆘 تذكرة دعم جديدة\n🎫 رقم التذكرة: ${ticket.ticketNumber}`,
  });
  await ctx.api.sendMessage(config.adminTelegramId, text);
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
  setSupportSession(userId, { awaitingMessage: true });
  await presentSupportPrompt(ctx);
}

export async function handleSupportCancel(ctx: Context): Promise<void> {
  if (ctx.from) {
    clearSupportSession(ctx.from.id);
  }
  await handleHelpMenu(ctx);
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

  if (!getSupportSession(user.id)) {
    return false;
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
