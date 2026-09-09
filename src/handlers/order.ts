import type { Context } from "grammy";
import { getAllProducts, getProductById } from "../data/products";
import { getContentItemById, getContentItemsByProductAndType } from "../database/content";
import { createOrder } from "../database/orders";
import {
  backToMainKeyboard,
  confirmOrderKeyboard,
  openMyProductsKeyboard,
  packageVideoListKeyboard,
  productListKeyboard,
} from "../keyboards/menus";
import { userHasVideoAccess } from "../services/contentAccess";
import { logger } from "../utils/logger";

export async function handleOrderMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const products = getAllProducts();

  const text =
    "🛒 *طلب المحتوى*\n\n" +
    "اختر الحزمة/القسم أولًا، ثم اختر الفيديو الذي تريد شراءه.\n\n" +
    "_الأسعار والدفع سيتم إضافتهما لاحقاً._";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: productListKeyboard(products),
  });
}

export async function handleProductSelect(
  ctx: Context,
  productId: string
): Promise<void> {
  await ctx.answerCallbackQuery();
  const product = getProductById(productId);

  if (!product) {
    await ctx.editMessageText("❌ المنتج غير موجود.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  const videos = getContentItemsByProductAndType(productId, "video");

  if (videos.length === 0) {
    await ctx.editMessageText(
      `📦 *${product.nameAr}*\n\n` +
        `${product.descriptionAr}\n\n` +
        "_لا توجد فيديوهات في هذه الحزمة حالياً._",
      {
        parse_mode: "Markdown",
        reply_markup: packageVideoListKeyboard([]),
      }
    );
    return;
  }

  const lines = videos.map((video) => `• ${video.titleAr}`);

  await ctx.editMessageText(
    `📦 *${product.nameAr}*\n\n` +
      `${product.descriptionAr}\n\n` +
      "*الفيديوهات المتاحة للطلب:*\n" +
      lines.join("\n") +
      "\n\n_اختر فيديو واحدًا تريد شراءه:_",
    {
      parse_mode: "Markdown",
      reply_markup: packageVideoListKeyboard(videos),
    }
  );
}

export async function handleVideoSelect(
  ctx: Context,
  contentId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const item = getContentItemById(contentId);
  const product = item ? getProductById(item.productId) : undefined;
  const user = ctx.from;

  if (!item || item.contentType !== "video" || !product) {
    await ctx.editMessageText("❌ الفيديو غير موجود.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  if (user && userHasVideoAccess(user.id, item.id)) {
    await ctx.editMessageText(
      "✅ *هذا الفيديو متاح بالفعل في حسابك.*\n\n" +
        `🎬 ${item.titleAr}\n` +
        `📦 ${product.nameAr}\n\n` +
        "يمكنك فتحه من قسم «منتجاتي».",
      {
        parse_mode: "Markdown",
        reply_markup: openMyProductsKeyboard(),
      }
    );
    return;
  }

  const text =
    `🎬 *${item.titleAr}*\n\n` +
    `📦 الحزمة: ${product.nameAr}\n\n` +
    (item.descriptionAr ? `${item.descriptionAr}\n\n` : "") +
    "هل ترغب بتأكيد طلب هذا الفيديو؟";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: confirmOrderKeyboard(item.id, item.productId),
  });
}

export async function handleConfirmOrder(
  ctx: Context,
  contentId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const item = getContentItemById(contentId);
  const product = item ? getProductById(item.productId) : undefined;
  const user = ctx.from;

  if (!item || item.contentType !== "video" || !product || !user) {
    await ctx.editMessageText("❌ تعذّر إتمام الطلب. حاول مرة أخرى.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  if (userHasVideoAccess(user.id, item.id)) {
    await ctx.editMessageText(
      "✅ *هذا الفيديو متاح بالفعل في حسابك.*\n\n" +
        "يمكنك فتحه من قسم «منتجاتي».",
      {
        parse_mode: "Markdown",
        reply_markup: openMyProductsKeyboard(),
      }
    );
    return;
  }

  try {
    const order = createOrder({
      telegramUserId: user.id,
      telegramUsername: user.username ?? null,
      productId: item.productId,
      contentId: item.id,
    });

    logger.info(
      `New order #${order.id} from user ${user.id} for video ${item.id} (${item.productId})`
    );

    const text =
      "✅ *تم استلام طلبك بنجاح!*\n\n" +
      `📋 رقم الطلب: \`${order.id}\`\n` +
      `📦 الحزمة: ${product.nameAr}\n` +
      `🎬 الفيديو: ${item.titleAr}\n` +
      `📌 الحالة: قيد المراجعة\n\n` +
      "سيتواصل معك فريقنا قريباً لإتمام العملية.\n" +
      "شكراً لثقتك في *3M Kids Zone*!";

    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: backToMainKeyboard(),
    });
  } catch (error) {
    logger.error("Failed to create order", error);
    await ctx.editMessageText(
      "❌ حدث خطأ أثناء إنشاء الطلب. يُرجى المحاولة لاحقاً.",
      { reply_markup: backToMainKeyboard() }
    );
  }
}
