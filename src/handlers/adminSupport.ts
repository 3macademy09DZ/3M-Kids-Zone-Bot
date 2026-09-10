import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import type { Message } from "grammy/types";
import {
  addSupportReply,
  closeSupportTicket,
  countSupportReplies,
  formatSupportCustomerName,
  getLatestSupportReply,
  getSupportTicketById,
  getSupportTicketCounts,
  isSupportTicketOpen,
  listSupportTickets,
  type SupportTicket,
  type SupportTicketListFilter,
} from "../database/supportTickets";
import { formatUsernameHandle } from "../database/users";
import {
  adminSupportCloseConfirmKeyboard,
  adminSupportDetailsKeyboard,
  adminSupportHubKeyboard,
  adminSupportListKeyboard,
  adminSupportReplyCancelKeyboard,
} from "../keyboards/menus";
import { clearAdminContentSession } from "../state/adminContentSession";
import { clearAdminPromoSession } from "../state/adminPromoSession";
import { clearAdminSettingsSession } from "../state/adminSettingsSession";
import {
  clearAdminSupportReplySession,
  getAdminSupportReplySession,
  setAdminSupportReplySession,
} from "../state/adminSupportSession";
import { formatApprovalDate } from "../utils/orderNumber";
import { logger } from "../utils/logger";

const TICKETS_PAGE_SIZE = 10;
const TELEGRAM_CAPTION_LIMIT = 1024;
const CLOSED_TICKET_MESSAGE = "هذه التذكرة مغلقة.";

const LIST_TITLES: Record<SupportTicketListFilter, string> = {
  open: "🟢 التذاكر المفتوحة",
  closed: "✅ التذاكر المغلقة",
  all: "📋 كل التذاكر",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function extractPhotoFileId(message: Message): string | null {
  if (!message.photo?.length) {
    return null;
  }
  return message.photo[message.photo.length - 1]?.file_id ?? null;
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

async function presentAdminText(
  ctx: Context,
  text: string,
  extra: {
    parse_mode?: "Markdown" | "HTML";
    reply_markup?: InlineKeyboard;
  }
): Promise<void> {
  if (ctx.callbackQuery && callbackMessageHasMedia(ctx)) {
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
    } catch {
      // Keep the original media message if markup cannot be cleared.
    }
    await ctx.reply(text, extra);
    return;
  }

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

function parseListFilter(raw: string): SupportTicketListFilter | null {
  if (raw === "open" || raw === "closed" || raw === "all") {
    return raw;
  }
  return null;
}

function buildDetailsText(ticket: SupportTicket): string {
  const username = formatUsernameHandle(ticket.username) ?? "غير متوفر";
  const problem = ticket.messageText ?? "تم إرسال صورة بدون نص.";
  const replyCount = countSupportReplies(ticket.id);
  const lastReply = getLatestSupportReply(ticket.id);
  const statusLabel = isSupportTicketOpen(ticket) ? "مفتوحة" : "مغلقة";

  let lastReplyBlock = "لا توجد ردود بعد.";
  if (lastReply) {
    const lastText = lastReply.messageText
      ? truncate(lastReply.messageText, 300)
      : "صورة";
    lastReplyBlock =
      `${escapeHtml(lastText)}\n` +
      `تاريخ آخر رد: ${escapeHtml(formatApprovalDate(lastReply.createdAt))}`;
  }

  return (
    "📂 <b>تفاصيل التذكرة</b>\n\n" +
    `🎫 رقم التذكرة: <code>${escapeHtml(ticket.ticketNumber)}</code>\n` +
    `👤 العميل: ${escapeHtml(formatSupportCustomerName(ticket))}\n` +
    `🔗 Username: ${escapeHtml(username)}\n` +
    `🆔 Telegram ID: <code>${ticket.telegramUserId}</code>\n` +
    `📌 الحالة: ${statusLabel}\n` +
    `🕒 تاريخ الإنشاء: ${escapeHtml(formatApprovalDate(ticket.createdAt))}\n\n` +
    "📝 نص المشكلة الأصلي:\n" +
    `${escapeHtml(truncate(problem, 2500))}\n\n` +
    `💬 عدد ردود الإدارة: ${replyCount}\n` +
    `📩 آخر رد:\n${lastReplyBlock}`
  );
}

async function showTicketDetails(ctx: Context, ticket: SupportTicket): Promise<void> {
  await presentAdminText(ctx, buildDetailsText(ticket), {
    parse_mode: "HTML",
    reply_markup: adminSupportDetailsKeyboard({
      ticketId: ticket.id,
      isOpen: isSupportTicketOpen(ticket),
    }),
  });
}

async function showClosedAlert(ctx: Context, ticket?: SupportTicket): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: CLOSED_TICKET_MESSAGE,
      show_alert: true,
    });
    if (ticket) {
      await showTicketDetails(ctx, ticket);
    }
    return;
  }

  await ctx.reply(CLOSED_TICKET_MESSAGE);
}

function buildCustomerReplyMessage(
  ticketNumber: string,
  replyText: string | null
): string {
  const body = replyText ? `\n${replyText}` : "";
  return (
    "💬 رد من إدارة 3M Kids Zone\n" +
    `🎫 التذكرة: ${ticketNumber}` +
    body
  );
}

async function sendReplyToCustomer(
  ctx: Context,
  ticket: SupportTicket,
  replyText: string | null,
  photoFileId: string | null
): Promise<void> {
  const text = buildCustomerReplyMessage(ticket.ticketNumber, replyText);

  if (!photoFileId) {
    await ctx.api.sendMessage(ticket.telegramUserId, text);
    return;
  }

  if (text.length <= TELEGRAM_CAPTION_LIMIT) {
    await ctx.api.sendPhoto(ticket.telegramUserId, photoFileId, {
      caption: text,
    });
    return;
  }

  await ctx.api.sendPhoto(ticket.telegramUserId, photoFileId, {
    caption: `💬 رد من إدارة 3M Kids Zone\n🎫 التذكرة: ${ticket.ticketNumber}`,
  });
  if (replyText) {
    await ctx.api.sendMessage(ticket.telegramUserId, text);
  }
}

export async function handleAdminSupportHub(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearAdminSupportReplySession(ctx.from.id);
  }

  const counts = getSupportTicketCounts();
  await presentAdminText(
    ctx,
    "🆘 *تذاكر الدعم*\n\nاختر القسم الذي تريد عرضه:",
    {
      parse_mode: "Markdown",
      reply_markup: adminSupportHubKeyboard(counts),
    }
  );
}

export async function handleAdminSupportList(
  ctx: Context,
  filterRaw: string,
  page: number
): Promise<void> {
  const filter = parseListFilter(filterRaw);
  if (!filter) {
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();
  const result = listSupportTickets(filter, page, TICKETS_PAGE_SIZE);

  if (result.total === 0) {
    await presentAdminText(
      ctx,
      `🆘 *${LIST_TITLES[filter]}*\n\nلا توجد تذاكر في هذا القسم.`,
      {
        parse_mode: "Markdown",
        reply_markup: adminSupportListKeyboard({
          filter,
          tickets: [],
          page: 0,
          totalPages: 1,
        }),
      }
    );
    return;
  }

  await presentAdminText(
    ctx,
    `🆘 *${LIST_TITLES[filter]}*\n\n` +
      `الصفحة ${result.page + 1} من ${result.totalPages}\n` +
      "الأحدث أولًا. اضغط تذكرة لعرض التفاصيل:",
    {
      parse_mode: "Markdown",
      reply_markup: adminSupportListKeyboard({
        filter,
        tickets: result.tickets.map((ticket) => ({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
        })),
        page: result.page,
        totalPages: result.totalPages,
      }),
    }
  );
}

export async function handleAdminSupportView(
  ctx: Context,
  ticketId: number
): Promise<void> {
  const ticket = getSupportTicketById(ticketId);
  if (!ticket) {
    await ctx.answerCallbackQuery({
      text: "التذكرة غير موجودة.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearAdminSupportReplySession(ctx.from.id);
  }
  await showTicketDetails(ctx, ticket);
}

export async function handleAdminSupportReplyStart(
  ctx: Context,
  ticketId: number
): Promise<void> {
  const adminId = ctx.from?.id;
  if (!adminId) {
    return;
  }

  const ticket = getSupportTicketById(ticketId);
  if (!ticket) {
    await ctx.answerCallbackQuery({
      text: "التذكرة غير موجودة.",
      show_alert: true,
    });
    return;
  }

  if (!isSupportTicketOpen(ticket)) {
    await showClosedAlert(ctx, ticket);
    return;
  }

  await ctx.answerCallbackQuery();
  clearAdminContentSession(adminId);
  clearAdminPromoSession(adminId);
  clearAdminSettingsSession(adminId);
  setAdminSupportReplySession(adminId, { ticketId: ticket.id });

  await presentAdminText(
    ctx,
    `اكتب ردك على التذكرة ${ticket.ticketNumber}`,
    {
      reply_markup: adminSupportReplyCancelKeyboard(ticket.id),
    }
  );
}

export async function handleAdminSupportReplyCancel(
  ctx: Context,
  ticketId: number
): Promise<void> {
  if (ctx.from) {
    clearAdminSupportReplySession(ctx.from.id);
  }

  const ticket = getSupportTicketById(ticketId);
  if (!ticket) {
    await ctx.answerCallbackQuery({
      text: "التذكرة غير موجودة.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  await showTicketDetails(ctx, ticket);
}

export async function handleAdminSupportCloseAsk(
  ctx: Context,
  ticketId: number
): Promise<void> {
  const ticket = getSupportTicketById(ticketId);
  if (!ticket) {
    await ctx.answerCallbackQuery({
      text: "التذكرة غير موجودة.",
      show_alert: true,
    });
    return;
  }

  if (!isSupportTicketOpen(ticket)) {
    await showClosedAlert(ctx, ticket);
    return;
  }

  await ctx.answerCallbackQuery();
  await presentAdminText(
    ctx,
    `هل تريد إغلاق التذكرة ${ticket.ticketNumber}؟`,
    {
      reply_markup: adminSupportCloseConfirmKeyboard(ticket.id),
    }
  );
}

export async function handleAdminSupportCloseConfirm(
  ctx: Context,
  ticketId: number
): Promise<void> {
  const ticket = getSupportTicketById(ticketId);
  if (!ticket) {
    await ctx.answerCallbackQuery({
      text: "التذكرة غير موجودة.",
      show_alert: true,
    });
    return;
  }

  if (!isSupportTicketOpen(ticket)) {
    await showClosedAlert(ctx, ticket);
    return;
  }

  const closed = closeSupportTicket(ticket.id);
  if (!closed) {
    await showClosedAlert(ctx, getSupportTicketById(ticket.id) ?? ticket);
    return;
  }

  await ctx.answerCallbackQuery({ text: "✅ تم إغلاق التذكرة" });

  try {
    await ctx.api.sendMessage(
      closed.telegramUserId,
      "✅ تم إغلاق تذكرة الدعم\n" +
        `🎫 ${closed.ticketNumber}\n` +
        "إذا احتجت مساعدة جديدة، يمكنك إنشاء تذكرة جديدة من قسم المساعدة."
    );
  } catch (error) {
    logger.error("Failed to notify customer of closed support ticket", error);
  }

  logger.info("Support ticket closed");
  await showTicketDetails(ctx, closed);
}

export async function handleAdminSupportReplyInput(
  ctx: Context
): Promise<boolean> {
  const adminId = ctx.from?.id;
  const message = ctx.message;
  if (!adminId || !message) {
    return false;
  }

  const session = getAdminSupportReplySession(adminId);
  if (!session) {
    return false;
  }

  const ticket = getSupportTicketById(session.ticketId);
  if (!ticket) {
    clearAdminSupportReplySession(adminId);
    await ctx.reply("التذكرة غير موجودة.");
    return true;
  }

  if (!isSupportTicketOpen(ticket)) {
    clearAdminSupportReplySession(adminId);
    await ctx.reply(CLOSED_TICKET_MESSAGE);
    return true;
  }

  const photoFileId = extractPhotoFileId(message);
  const replyText = (photoFileId ? message.caption : message.text)?.trim() ?? "";

  if (!photoFileId && !replyText) {
    await ctx.reply("❌ يُرجى إرسال رد نصي أو صورة.", {
      reply_markup: adminSupportReplyCancelKeyboard(ticket.id),
    });
    return true;
  }

  try {
    await sendReplyToCustomer(ctx, ticket, replyText || null, photoFileId);
  } catch (error) {
    logger.error("Failed to send support reply to customer", error);
    await ctx.reply("❌ تعذّر إرسال الرد إلى العميل. حاول مرة أخرى.", {
      reply_markup: adminSupportReplyCancelKeyboard(ticket.id),
    });
    return true;
  }

  try {
    addSupportReply({
      ticketId: ticket.id,
      messageText: replyText || null,
      photoFileId,
    });
  } catch (error) {
    logger.error("Failed to store support reply after sending", error);
  }

  clearAdminSupportReplySession(adminId);
  logger.info("Support reply sent to customer");
  await ctx.reply("✅ تم إرسال الرد إلى العميل.");
  await showTicketDetails(ctx, ticket);
  return true;
}
