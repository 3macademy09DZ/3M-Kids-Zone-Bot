import type { Context } from "grammy";
import type { Message } from "grammy/types";
import { getAllProducts, getProductById } from "../data/products";
import { createContentItem } from "../database/content";
import {
  CONTENT_TYPE_LABELS,
  type ContentType,
  type MediaKind,
} from "../database/contentTypes";
import {
  adminBackKeyboard,
  adminContentAddKeyboard,
  adminContentProductKeyboard,
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
  titleAr: string;
}

function extractMediaFromMessage(message: Message): ExtractedMedia | null {
  const caption = message.caption?.trim();

  if (message.video) {
    return {
      telegramFileId: message.video.file_id,
      telegramFileUniqueId: message.video.file_unique_id,
      mediaKind: "video",
      fileName: null,
      mimeType: message.video.mime_type ?? null,
      titleAr: caption || "فيديو تعليمي",
    };
  }

  if (message.document) {
    return {
      telegramFileId: message.document.file_id,
      telegramFileUniqueId: message.document.file_unique_id,
      mediaKind: "document",
      fileName: message.document.file_name ?? null,
      mimeType: message.document.mime_type ?? null,
      titleAr: caption || message.document.file_name || "ملف",
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
      titleAr: caption || "صورة",
    };
  }

  if (message.animation) {
    return {
      telegramFileId: message.animation.file_id,
      telegramFileUniqueId: message.animation.file_unique_id,
      mediaKind: "animation",
      fileName: message.animation.file_name ?? null,
      mimeType: message.animation.mime_type ?? null,
      titleAr: caption || "محتوى تفاعلي",
    };
  }

  return null;
}

function getUploadPrompt(contentType: ContentType): string {
  switch (contentType) {
    case "video":
      return "🎬 أرسل الآن *الفيديو* الذي تريد إضافته.\n\n_يمكنك إرفاق عنوان في وصف الرسالة (caption)._";
    case "game":
      return "🎮 أرسل الآن *اللعبة/النشاط* (فيديو، صورة، أو ملف).\n\n_يمكنك إرفاق عنوان في وصف الرسالة (caption)._";
    case "file":
      return "📁 أرسل الآن *الملف* (PDF، Word، ZIP، صورة، …).\n\n_يمكنك إرفاق عنوان في وصف الرسالة (caption)._";
  }
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

  setAdminContentSession(adminId, { productId, contentType });

  await ctx.editMessageText(
    `📚 *${product.nameAr}*\n` +
      `${CONTENT_TYPE_LABELS[contentType]}\n\n` +
      getUploadPrompt(contentType),
    {
      parse_mode: "Markdown",
      reply_markup: adminContentAddKeyboard(productId, contentType),
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

  const media = extractMediaFromMessage(message);
  if (!media) {
    await ctx.reply(
      "❌ نوع الرسالة غير مدعوم. يُرجى إرسال فيديو، صورة، أو ملف.",
      {
        reply_markup: adminContentAddKeyboard(
          session.productId,
          session.contentType
        ),
      }
    );
    return true;
  }

  try {
    const item = createContentItem({
      productId: session.productId,
      contentType: session.contentType,
      titleAr: media.titleAr,
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
