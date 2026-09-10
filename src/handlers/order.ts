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
import { validatePromoForCheckout } from "../database/promos";
import {
  backToMainKeyboard,
  confirmOrderKeyboard,
  openMyProductsKeyboard,
  packageVideoListKeyboard,
  paymentMethodKeyboard,
  productListKeyboard,
  promoChoiceKeyboard,
  promoConfirmKeyboard,
  promoInvalidKeyboard,
} from "../keyboards/menus";
import { userHasVideoAccess } from "../services/contentAccess";
import {
  clearCheckoutSession,
  getCheckoutSession,
  setCheckoutSession,
} from "../state/checkoutSession";
import { getOrderDisplayNumber } from "../utils/orderNumber";
import { formatPriceDzd } from "../utils/price";
import {
  calculatePromoQuote,
  catalogPriceForPromo,
} from "../utils/promoPrice";
import { logger } from "../utils/logger";
import type { User } from "grammy/types";

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

const PROMO_INVALID_REASONS: Record<string, string> = {
  invalid: "الكود فارغ أو غير صالح.",
  not_found: "هذا الكود غير موجود.",
  inactive: "هذا الكود معطّل حالياً.",
  expired: "هذا الكود منتهي الصلاحية.",
  max_uses: "تم الوصول إلى الحد الأقصى لاستعمال هذا الكود.",
};

function buildItemIntro(
  item: ProductContentItem,
  productName: string
): string {
  const itemLabel = CONTENT_TYPE_ITEM_LABEL[item.contentType];
  const emoji = CONTENT_TYPE_EMOJI[item.contentType];
  return (
    `${emoji} *${item.titleAr}*\n\n` +
    `📌 النوع: ${itemLabel}\n` +
    `📦 الحزمة: ${productName}\n` +
    `💰 السعر: ${formatPriceDzd(item.price)}\n\n` +
    (item.descriptionAr ? `${item.descriptionAr}\n\n` : "")
  );
}

export async function handleOrderMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }
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
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }
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

  if (user) {
    clearCheckoutSession(user.id);
  }

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
    buildItemIntro(item, product.nameAr) +
    "هل لديك كود تخفيض؟";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: promoChoiceKeyboard(item.id, item.productId),
  });
}

async function showPlainConfirm(
  ctx: Context,
  item: ProductContentItem,
  productName: string
): Promise<void> {
  const itemLabel = CONTENT_TYPE_ITEM_LABEL[item.contentType];
  const text =
    buildItemIntro(item, productName) +
    `هل ترغب بتأكيد طلب هذا ${itemLabel}؟`;

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: confirmOrderKeyboard(item.id, item.productId),
  });
}

export async function handlePromoSkip(
  ctx: Context,
  contentId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }

  const item = getContentItemById(contentId);
  const product = item ? getProductById(item.productId) : undefined;
  if (!item || !isPurchasableContentType(item.contentType) || !product) {
    await ctx.editMessageText("❌ المحتوى غير موجود.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  await showPlainConfirm(ctx, item, product.nameAr);
}

export async function handlePromoHas(
  ctx: Context,
  contentId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  await promptForPromoCode(ctx, contentId);
}

export async function handlePromoRetry(
  ctx: Context,
  contentId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  await promptForPromoCode(ctx, contentId);
}

async function promptForPromoCode(ctx: Context, contentId: number): Promise<void> {
  const user = ctx.from;
  const item = getContentItemById(contentId);
  const product = item ? getProductById(item.productId) : undefined;

  if (!user || !item || !isPurchasableContentType(item.contentType) || !product) {
    await ctx.editMessageText("❌ تعذّر متابعة كود التخفيض.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  if (catalogPriceForPromo(item.price) == null) {
    await ctx.editMessageText(
      buildItemIntro(item, product.nameAr) +
        "❌ لا يمكن تطبيق كود تخفيض على عنصر بدون سعر محدد.\n" +
        "يمكنك المتابعة بدون كود.",
      {
        parse_mode: "Markdown",
        reply_markup: promoInvalidKeyboard(item.id),
      }
    );
    return;
  }

  setCheckoutSession(user.id, { contentId: item.id, awaitingCode: true });

  await ctx.editMessageText(
    buildItemIntro(item, product.nameAr) +
      "🎟️ أرسل *كود التخفيض* الآن كنص.\n" +
      "مثال: `WELCOME10`",
    {
      parse_mode: "Markdown",
      reply_markup: promoInvalidKeyboard(item.id),
    }
  );
}

function invalidPromoText(reason: string): string {
  return (
    "❌ *كود التخفيض غير صالح*\n\n" +
    `السبب: ${PROMO_INVALID_REASONS[reason] ?? "تعذّر التحقق من الكود."}`
  );
}

export async function handleCheckoutPromoInput(ctx: Context): Promise<boolean> {
  const user = ctx.from;
  const message = ctx.message;
  if (!user || !message) {
    return false;
  }

  const session = getCheckoutSession(user.id);
  if (!session?.awaitingCode) {
    return false;
  }

  const item = getContentItemById(session.contentId);
  const product = item ? getProductById(item.productId) : undefined;
  if (!item || !isPurchasableContentType(item.contentType) || !product) {
    clearCheckoutSession(user.id);
    await ctx.reply("❌ تعذّر متابعة الطلب. ابدأ من جديد.", {
      reply_markup: backToMainKeyboard(),
    });
    return true;
  }

  const raw = message.text?.trim();
  if (!raw) {
    await ctx.reply("🎟️ أرسل *كود التخفيض* كنص.", {
      parse_mode: "Markdown",
      reply_markup: promoInvalidKeyboard(item.id),
    });
    return true;
  }

  const originalPrice = catalogPriceForPromo(item.price);
  const validated = validatePromoForCheckout(raw);
  if (originalPrice == null || !validated.ok) {
    await ctx.reply(
      invalidPromoText(
        originalPrice == null ? "invalid" : validated.ok ? "invalid" : validated.reason
      ) +
        "\n\nيمكنك إدخال كود آخر أو المتابعة بدون كود.",
      {
        parse_mode: "Markdown",
        reply_markup: promoInvalidKeyboard(item.id),
      }
    );
    return true;
  }

  const quote = calculatePromoQuote(
    originalPrice,
    validated.promo.discountType,
    validated.promo.discountValue
  );

  setCheckoutSession(user.id, {
    contentId: item.id,
    awaitingCode: false,
    applied: {
      code: validated.promo.code,
      originalPrice: quote.originalPrice,
      discountAmount: quote.discountAmount,
      finalPrice: quote.finalPrice,
    },
  });

  await ctx.reply(
    `📦 المنتج: ${item.titleAr}\n` +
      `💰 السعر الأصلي: ${formatPriceDzd(quote.originalPrice)}\n` +
      `🎟️ كود التخفيض: ${validated.promo.code}\n` +
      `💸 التخفيض: ${formatPriceDzd(quote.discountAmount)}\n` +
      `✅ السعر النهائي: ${formatPriceDzd(quote.finalPrice)}\n\n` +
      "هل ترغب بتأكيد الطلب؟",
    {
      reply_markup: promoConfirmKeyboard(item.id, item.productId),
    }
  );
  return true;
}

async function createOrderAndAskPayment(
  ctx: Context,
  user: User,
  item: ProductContentItem,
  productName: string,
  pricing: {
    purchasePrice: number | null;
    promoCode?: string | null;
    originalPrice?: number | null;
    discountAmount?: number | null;
  }
): Promise<void> {
  const itemLabel = CONTENT_TYPE_ITEM_LABEL[item.contentType];
  const emoji = CONTENT_TYPE_EMOJI[item.contentType];

  try {
    const order = createOrder({
      telegramUserId: user.id,
      telegramUsername: user.username ?? null,
      productId: item.productId,
      contentId: item.id,
      purchasePrice: pricing.purchasePrice,
      promoCode: pricing.promoCode ?? null,
      originalPrice: pricing.originalPrice ?? null,
      discountAmount: pricing.discountAmount ?? null,
    });

    logger.info(
      `New order #${order.id} from user ${user.id} for ${item.contentType} ${item.id} (${item.productId})`
    );

    const priceLines = order.promoCode
      ? `💰 السعر الأصلي: ${formatPriceDzd(order.originalPrice)}\n` +
        `🎟️ كود التخفيض: ${order.promoCode}\n` +
        `💸 التخفيض: ${formatPriceDzd(order.discountAmount)}\n` +
        `✅ السعر النهائي: ${formatPriceDzd(order.purchasePrice)}\n`
      : `💰 السعر: ${formatPriceDzd(order.purchasePrice ?? item.price)}\n`;

    const text =
      "✅ *تم إنشاء طلبك*\n\n" +
      `🧾 رقم الطلب: \`${getOrderDisplayNumber(order)}\`\n` +
      `📦 الحزمة: ${productName}\n` +
      `${emoji} ${itemLabel}: ${item.titleAr}\n` +
      priceLines +
      "\nاختر طريقة الدفع لإتمام الطلب:";

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

  if (userHasVideoAccess(user.id, item.id)) {
    clearCheckoutSession(user.id);
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

  clearCheckoutSession(user.id);
  await createOrderAndAskPayment(ctx, user, item, product.nameAr, {
    purchasePrice: item.price,
  });
}

export async function handlePromoConfirm(
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

  if (userHasVideoAccess(user.id, item.id)) {
    clearCheckoutSession(user.id);
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

  const session = getCheckoutSession(user.id);
  const applied =
    session?.contentId === item.id && session.applied ? session.applied : null;

  if (!applied) {
    await ctx.editMessageText(
      "❌ انتهت جلسة كود التخفيض. يمكنك المتابعة بدون كود أو إدخال الكود مرة أخرى.",
      {
        reply_markup: promoInvalidKeyboard(item.id),
      }
    );
    return;
  }

  const originalPrice = catalogPriceForPromo(item.price);
  const validated = validatePromoForCheckout(applied.code);
  if (originalPrice == null || !validated.ok) {
    setCheckoutSession(user.id, { contentId: item.id, awaitingCode: true });
    await ctx.editMessageText(
      invalidPromoText(
        originalPrice == null ? "invalid" : validated.ok ? "invalid" : validated.reason
      ) +
        "\n\nيمكنك إدخال كود آخر أو المتابعة بدون كود.",
      {
        parse_mode: "Markdown",
        reply_markup: promoInvalidKeyboard(item.id),
      }
    );
    return;
  }

  const quote = calculatePromoQuote(
    originalPrice,
    validated.promo.discountType,
    validated.promo.discountValue
  );

  clearCheckoutSession(user.id);
  await createOrderAndAskPayment(ctx, user, item, product.nameAr, {
    purchasePrice: quote.finalPrice,
    promoCode: validated.promo.code,
    originalPrice: quote.originalPrice,
    discountAmount: quote.discountAmount,
  });
}
