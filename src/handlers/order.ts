import type { Context } from "grammy";
import { getAllProducts, getProductById } from "../data/products";
import { getContentItemById, getContentItemsByProductAndType } from "../database/content";
import {
  CONTENT_TYPE_EMOJI,
  CONTENT_TYPE_ITEM_LABEL,
  CONTENT_TYPE_LABELS,
  isPurchasableContentType,
  type ProductContentItem,
} from "../database/contentTypes";
import { createOrder } from "../database/orders";
import {
  backToMainKeyboard,
  confirmOrderKeyboard,
  openMyProductsKeyboard,
  packageVideoListKeyboard,
  paymentMethodKeyboard,
  productListKeyboard,
} from "../keyboards/menus";
import { userHasVideoAccess } from "../services/contentAccess";
import { getOrderDisplayNumber } from "../utils/orderNumber";
import { formatPriceDzd } from "../utils/price";
import { logger } from "../utils/logger";

function getPurchasableItems(productId: string): ProductContentItem[] {
  return [
    ...getContentItemsByProductAndType(productId, "video"),
    ...getContentItemsByProductAndType(productId, "game"),
  ];
}

function buildPurchasableListText(items: ProductContentItem[]): string {
  const videos = items.filter((item) => item.contentType === "video");
  const games = items.filter((item) => item.contentType === "game");
  const sections: string[] = [];

  if (videos.length > 0) {
    sections.push(
      `*${CONTENT_TYPE_LABELS.video} المتاحة للطلب:*`,
      ...videos.map(
        (item) => `• ${item.titleAr} — ${formatPriceDzd(item.price)}`
      )
    );
  }

  if (games.length > 0) {
    sections.push(
      `*${CONTENT_TYPE_LABELS.game} المتاحة للطلب:*`,
      ...games.map(
        (item) => `• ${item.titleAr} — ${formatPriceDzd(item.price)}`
      )
    );
  }

  return sections.join("\n");
}

export async function handleOrderMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const products = getAllProducts();

  const text =
    "🛒 *طلب المحتوى*\n\n" +
    "اختر الحزمة/القسم أولًا، ثم اختر الفيديو أو اللعبة/النشاط الذي تريد شراءه.";

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

  const items = getPurchasableItems(productId);

  if (items.length === 0) {
    await ctx.editMessageText(
      `📦 *${product.nameAr}*\n\n` +
        `${product.descriptionAr}\n\n` +
        "_لا توجد فيديوهات أو ألعاب/أنشطة في هذه الحزمة حالياً._",
      {
        parse_mode: "Markdown",
        reply_markup: packageVideoListKeyboard([]),
      }
    );
    return;
  }

  await ctx.editMessageText(
    `📦 *${product.nameAr}*\n\n` +
      `${product.descriptionAr}\n\n` +
      buildPurchasableListText(items) +
      "\n\n_اختر عنصراً واحداً تريد شراءه:_",
    {
      parse_mode: "Markdown",
      reply_markup: packageVideoListKeyboard(items),
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

  if (!item || !isPurchasableContentType(item.contentType) || !product) {
    await ctx.editMessageText("❌ المحتوى غير موجود.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  const itemLabel = CONTENT_TYPE_ITEM_LABEL[item.contentType];
  const emoji = CONTENT_TYPE_EMOJI[item.contentType];

  if (user && userHasVideoAccess(user.id, item.id)) {
    await ctx.editMessageText(
      `✅ *هذا ${itemLabel} متاح بالفعل في حسابك.*\n\n` +
        `${emoji} ${item.titleAr}\n` +
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
    `${emoji} *${item.titleAr}*\n\n` +
    `📌 النوع: ${itemLabel}\n` +
    `📦 الحزمة: ${product.nameAr}\n` +
    `💰 السعر: ${formatPriceDzd(item.price)}\n\n` +
    (item.descriptionAr ? `${item.descriptionAr}\n\n` : "") +
    `هل ترغب بتأكيد طلب هذا ${itemLabel}؟`;

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

  if (!item || !isPurchasableContentType(item.contentType) || !product || !user) {
    await ctx.editMessageText("❌ تعذّر إتمام الطلب. حاول مرة أخرى.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  const itemLabel = CONTENT_TYPE_ITEM_LABEL[item.contentType];
  const emoji = CONTENT_TYPE_EMOJI[item.contentType];

  if (userHasVideoAccess(user.id, item.id)) {
    await ctx.editMessageText(
      `✅ *هذا ${itemLabel} متاح بالفعل في حسابك.*\n\n` +
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
      purchasePrice: item.price,
    });

    logger.info(
      `New order #${order.id} from user ${user.id} for ${item.contentType} ${item.id} (${item.productId})`
    );

    const text =
      "✅ *تم إنشاء طلبك*\n\n" +
      `🧾 رقم الطلب: \`${getOrderDisplayNumber(order)}\`\n` +
      `📦 الحزمة: ${product.nameAr}\n` +
      `${emoji} ${itemLabel}: ${item.titleAr}\n` +
      `💰 السعر: ${formatPriceDzd(item.price)}\n\n` +
      "اختر طريقة الدفع لإتمام الطلب:";

    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      reply_markup: paymentMethodKeyboard(order.id),
    });
  } catch (error) {
    logger.error("Failed to create order", error);
    await ctx.editMessageText(
      "❌ حدث خطأ أثناء إنشاء الطلب. يُرجى المحاولة لاحقاً.",
      { reply_markup: backToMainKeyboard() }
    );
  }
}
