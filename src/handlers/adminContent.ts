import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { getAllProducts, getProductById } from "../data/products";
import {
  createContentItem,
  deleteContentItem,
  getContentItemById,
  updateContentItemTitle,
} from "../database/content";
import {
  CONTENT_TYPE_EMOJI,
  CONTENT_TYPE_ITEM_LABEL,
  CONTENT_TYPE_LABELS,
  type ContentType,
  type MediaKind,
} from "../database/contentTypes";
import {
  adminBackKeyboard,
  adminContentAddKeyboard,
  adminContentDeleteConfirmKeyboard,
  adminContentItemKeyboard,
  adminContentProductKeyboard,
  adminContentRenameKeyboard,
} from "../keyboards/menus";
import {
  clearAdminContentSession,
  getAdminContentSession,
  setAdminContentSession,
} from "../state/adminContentSession";
import {
  adminProductSectionsKeyboard,
  adminSectionKeyboard,
  buildAdminProductSectionsMessage,
  buildAdminSectionMessage,
} from "../utils/productContentView";
import { logger } from "../utils/logger";

interface ExtractedMedia {
  telegramFileId: string;
  telegramFileUniqueId: string | null;
  mediaKind: MediaKind;
  fileName: string | null;
  mimeType: string | null;
}

function isVideoDocument(message: Message): boolean {
  const doc = message.document;
  if (!doc) return false;
  const mime = (doc.mime_type ?? "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  const name = (doc.file_name ?? "").toLowerCase();
  return /\.(mp4|mov|mkv|webm|avi)$/.test(name);
}

function extractMediaFromMessage(message: Message): ExtractedMedia | null {
  if (message.video) {
    return {
      telegramFileId: message.video.file_id,
      telegramFileUniqueId: message.video.file_unique_id,
      mediaKind: "video",
      fileName: null,
      mimeType: message.video.mime_type ?? null,
    };
  }

  if (message.document) {
    return {
      telegramFileId: message.document.file_id,
      telegramFileUniqueId: message.document.file_unique_id,
      mediaKind: "document",
      fileName: message.document.file_name ?? null,
      mimeType: message.document.mime_type ?? null,
    };
  }

  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    return {
      telegramFileId: photo.file_id,
      telegramFileUniqueId: photo.file_unique_id,
      mediaKind: "photo",
      fileName: null,
      mimeType: "image/jpeg",
    };
  }

  if (message.animation) {
    return {
      telegramFileId: message.animation.file_id,
      telegramFileUniqueId: message.animation.file_unique_id,
      mediaKind: "animation",
      fileName: message.animation.file_name ?? null,
      mimeType: message.animation.mime_type ?? null,
    };
  }

  return null;
}

function extractMediaForType(
  message: Message,
  contentType: ContentType
): ExtractedMedia | null {
  switch (contentType) {
    case "video":
      if (message.video || isVideoDocument(message)) {
        return extractMediaFromMessage(message);
      }
      return null;
    case "file":
      if (message.document) {
        return extractMediaFromMessage(message);
      }
      return null;
    case "game":
      if (
        message.document ||
        message.video ||
        message.photo?.length ||
        message.animation
      ) {
        return extractMediaFromMessage(message);
      }
      return null;
  }
}

function getNamePrompt(contentType: ContentType): string {
  const label = CONTENT_TYPE_ITEM_LABEL[contentType];
  return `✏️ أرسل الآن *اسم* ${label} الجديد كنص.`;
}

function getUploadPrompt(contentType: ContentType): string {
  switch (contentType) {
    case "video":
      return "🎬 أرسل الآن *الفيديو* (فيديو تيليجرام أو ملف فيديو).";
    case "game":
      return "🎮 أرسل الآن *ملف اللعبة/النشاط* (ملف أو مستند).";
    case "file":
      return "📁 أرسل الآن *الملف* (PDF أو أي مستند).";
  }
}

function getUnsupportedMediaMessage(contentType: ContentType): string {
  switch (contentType) {
    case "video":
      return "❌ يُرجى إرسال فيديو تيليجرام أو ملف فيديو.";
    case "game":
      return "❌ يُرجى إرسال ملف أو مستند للعبة/النشاط.";
    case "file":
      return "❌ يُرجى إرسال مستند مثل PDF.";
  }
}

function buildAdminItemMessage(
  productName: string,
  contentType: ContentType,
  titleAr: string
): string {
  return (
    `📚 *${productName}*\n` +
    `${CONTENT_TYPE_LABELS[contentType]}\n\n` +
    `${CONTENT_TYPE_EMOJI[contentType]} *${titleAr}*\n\n` +
    "_اختر إجراءً لإدارة هذا العنصر:_"
  );
}

export async function handleAdminContentMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const products = getAllProducts();

  await ctx.editMessageText(
    "📚 *إدارة المحتوى*\n\n" + "اختر المنتج الذي تريد إدارة محتواه:",
    {
      parse_mode: "Markdown",
      reply_markup: adminContentProductKeyboard(products),
    }
  );
}

export async function handleAdminContentProduct(
  ctx: Context,
  productId: string
): Promise<void> {
  await ctx.answerCallbackQuery();
  const product = getProductById(productId);

  if (!product) {
    await ctx.editMessageText("❌ المنتج غير موجود.", {
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  if (ctx.from?.id) {
    clearAdminContentSession(ctx.from.id);
  }

  await ctx.editMessageText(
    buildAdminProductSectionsMessage(product.nameAr, productId),
    {
      parse_mode: "Markdown",
      reply_markup: adminProductSectionsKeyboard(productId),
    }
  );
}

export async function handleAdminContentSection(
  ctx: Context,
  productId: string,
  contentType: ContentType
): Promise<void> {
  await ctx.answerCallbackQuery();
  const product = getProductById(productId);

  if (!product) {
    await ctx.editMessageText("❌ المنتج غير موجود.", {
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  if (ctx.from?.id) {
    clearAdminContentSession(ctx.from.id);
  }

  await ctx.editMessageText(
    buildAdminSectionMessage(product.nameAr, contentType, productId),
    {
      parse_mode: "Markdown",
      reply_markup: adminSectionKeyboard(productId, contentType),
    }
  );
}

export async function handleAdminContentAdd(
  ctx: Context,
  productId: string,
  contentType: ContentType
): Promise<void> {
  await ctx.answerCallbackQuery();
  const product = getProductById(productId);
  const adminId = ctx.from?.id;

  if (!product || !adminId) {
    return;
  }

  setAdminContentSession(adminId, {
    productId,
    contentType,
    step: "awaiting_title",
  });

  await ctx.editMessageText(
    `📚 *${product.nameAr}*\n` +
      `${CONTENT_TYPE_LABELS[contentType]}\n\n` +
      getNamePrompt(contentType),
    {
      parse_mode: "Markdown",
      reply_markup: adminContentAddKeyboard(productId, contentType),
    }
  );
}

export async function handleAdminContentItem(
  ctx: Context,
  contentItemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminContentSession(ctx.from.id);
  }

  const item = getContentItemById(contentItemId);
  if (!item) {
    await ctx.editMessageText("❌ العنصر غير موجود.", {
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  const product = getProductById(item.productId);

  await ctx.editMessageText(
    buildAdminItemMessage(
      product?.nameAr ?? item.productId,
      item.contentType,
      item.titleAr
    ),
    {
      parse_mode: "Markdown",
      reply_markup: adminContentItemKeyboard(item),
    }
  );
}

export async function handleAdminContentRename(
  ctx: Context,
  contentItemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const item = getContentItemById(contentItemId);

  if (!item || !adminId) {
    return;
  }

  setAdminContentSession(adminId, {
    productId: item.productId,
    contentType: item.contentType,
    step: "awaiting_rename",
    contentItemId: item.id,
  });

  const product = getProductById(item.productId);

  await ctx.editMessageText(
    `📚 *${product?.nameAr ?? item.productId}*\n` +
      `${CONTENT_TYPE_LABELS[item.contentType]}\n\n` +
      `الاسم الحالي: *${item.titleAr}*\n\n` +
      "✏️ أرسل الآن *الاسم الجديد* كنص.",
    {
      parse_mode: "Markdown",
      reply_markup: adminContentRenameKeyboard(item),
    }
  );
}

export async function handleAdminContentDelete(
  ctx: Context,
  contentItemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const item = getContentItemById(contentItemId);

  if (!item) {
    await ctx.editMessageText("❌ العنصر غير موجود.", {
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  const product = getProductById(item.productId);

  await ctx.editMessageText(
    `⚠️ *تأكيد الحذف*\n\n` +
      `📚 ${product?.nameAr ?? item.productId}\n` +
      `${CONTENT_TYPE_EMOJI[item.contentType]} ${item.titleAr}\n\n` +
      "هل أنت متأكد من حذف هذا العنصر؟\n" +
      "_لا يمكن التراجع عن هذا الإجراء._",
    {
      parse_mode: "Markdown",
      reply_markup: adminContentDeleteConfirmKeyboard(item),
    }
  );
}

export async function handleAdminContentDeleteConfirm(
  ctx: Context,
  contentItemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const item = getContentItemById(contentItemId);

  if (!item) {
    await ctx.editMessageText("❌ العنصر غير موجود أو تم حذفه مسبقاً.", {
      reply_markup: adminBackKeyboard(),
    });
    return;
  }

  const deleted = deleteContentItem(item.id);
  const product = getProductById(item.productId);

  if (!deleted) {
    await ctx.editMessageText("❌ تعذّر حذف العنصر. حاول مرة أخرى.", {
      reply_markup: adminContentItemKeyboard(item),
    });
    return;
  }

  await ctx.editMessageText(
    "✅ *تم حذف العنصر بنجاح.*\n\n" +
      `📚 ${product?.nameAr ?? item.productId}\n` +
      `${CONTENT_TYPE_LABELS[item.contentType]}\n` +
      `📝 ${item.titleAr}`,
    {
      parse_mode: "Markdown",
      reply_markup: adminSectionKeyboard(item.productId, item.contentType),
    }
  );
}

export async function handleAdminContentUpload(ctx: Context): Promise<boolean> {
  const adminId = ctx.from?.id;
  const message = ctx.message;

  if (!adminId || !message) {
    return false;
  }

  const session = getAdminContentSession(adminId);
  if (!session) {
    return false;
  }

  if (session.step === "awaiting_title") {
    const title = message.text?.trim();
    if (!title) {
      await ctx.reply("❌ أرسل *اسم العنصر* كنص أولاً.", {
        parse_mode: "Markdown",
        reply_markup: adminContentAddKeyboard(
          session.productId,
          session.contentType
        ),
      });
      return true;
    }

    setAdminContentSession(adminId, {
      ...session,
      titleAr: title,
      step: "awaiting_media",
    });

    const product = getProductById(session.productId);
    await ctx.reply(
      `📚 *${product?.nameAr ?? session.productId}*\n` +
        `${CONTENT_TYPE_LABELS[session.contentType]}\n\n` +
        `✅ تم حفظ الاسم: *${title}*\n\n` +
        getUploadPrompt(session.contentType),
      {
        parse_mode: "Markdown",
        reply_markup: adminContentAddKeyboard(
          session.productId,
          session.contentType
        ),
      }
    );
    return true;
  }

  if (session.step === "awaiting_rename") {
    const title = message.text?.trim();
    const item =
      session.contentItemId != null
        ? getContentItemById(session.contentItemId)
        : null;

    if (!item) {
      clearAdminContentSession(adminId);
      await ctx.reply("❌ العنصر غير موجود.", {
        reply_markup: adminBackKeyboard(),
      });
      return true;
    }

    if (!title) {
      await ctx.reply("❌ أرسل *الاسم الجديد* كنص.", {
        parse_mode: "Markdown",
        reply_markup: adminContentRenameKeyboard(item),
      });
      return true;
    }

    const updated = updateContentItemTitle(item.id, title);
    clearAdminContentSession(adminId);

    if (!updated) {
      await ctx.reply("❌ تعذّر تحديث الاسم. حاول مرة أخرى.", {
        reply_markup: adminContentItemKeyboard(item),
      });
      return true;
    }

    const product = getProductById(updated.productId);
    await ctx.reply(
      "✅ *تم تغيير الاسم بنجاح.*\n\n" +
        buildAdminItemMessage(
          product?.nameAr ?? updated.productId,
          updated.contentType,
          updated.titleAr
        ),
      {
        parse_mode: "Markdown",
        reply_markup: adminContentItemKeyboard(updated),
      }
    );
    return true;
  }

  if (session.step !== "awaiting_media") {
    return false;
  }

  const media = extractMediaForType(message, session.contentType);
  if (!media) {
    await ctx.reply(getUnsupportedMediaMessage(session.contentType), {
      reply_markup: adminContentAddKeyboard(
        session.productId,
        session.contentType
      ),
    });
    return true;
  }

  const titleAr = session.titleAr?.trim();
  if (!titleAr) {
    setAdminContentSession(adminId, {
      ...session,
      step: "awaiting_title",
    });
    await ctx.reply("❌ أرسل *اسم العنصر* كنص أولاً.", {
      parse_mode: "Markdown",
      reply_markup: adminContentAddKeyboard(
        session.productId,
        session.contentType
      ),
    });
    return true;
  }

  try {
    const item = createContentItem({
      productId: session.productId,
      contentType: session.contentType,
      titleAr,
      telegramFileId: media.telegramFileId,
      telegramFileUniqueId: media.telegramFileUniqueId,
      mediaKind: media.mediaKind,
      fileName: media.fileName,
      mimeType: media.mimeType,
    });

    const product = getProductById(session.productId);
    const savedProductId = session.productId;
    const savedContentType = session.contentType;

    clearAdminContentSession(adminId);

    await ctx.reply(
      "✅ *تمت إضافة المحتوى بنجاح!*\n\n" +
        `📦 المنتج: ${product?.nameAr ?? savedProductId}\n` +
        `📌 القسم: ${CONTENT_TYPE_LABELS[savedContentType]}\n` +
        `📝 العنوان: ${item.titleAr}`,
      {
        parse_mode: "Markdown",
        reply_markup: adminSectionKeyboard(savedProductId, savedContentType),
      }
    );
  } catch (error) {
    logger.error("Failed to save content item", error);
    await ctx.reply("❌ حدث خطأ أثناء حفظ المحتوى. حاول مرة أخرى.");
  }

  return true;
}
