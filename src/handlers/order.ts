import type { Context } from "grammy";
import {
  ACADEMY_LINK_PENDING_ALERT,
  TELEGRAM_CHECKOUT_DISABLED_ALERT,
} from "../config/academy";
import { getAllProducts, getProductById } from "../data/products";
import { getContentItemById, getContentItemsByProductAndType } from "../database/content";
import {
  CONTENT_TYPE_EMOJI,
  CONTENT_TYPE_ITEM_LABEL,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  type ProductContentItem,
} from "../database/contentTypes";
import {
  backToMainKeyboard,
  catalogItemDetailsKeyboard,
  packageVideoListKeyboard,
  productListKeyboard,
} from "../keyboards/menus";
import { clearCheckoutSession } from "../state/checkoutSession";
import { formatPriceDzd } from "../utils/price";

function getCatalogItems(productId: string): ProductContentItem[] {
  return CONTENT_TYPES.flatMap((type) =>
    getContentItemsByProductAndType(productId, type)
  );
}

function buildCatalogListText(items: ProductContentItem[]): string {
  const sections: string[] = [];

  for (const type of CONTENT_TYPES) {
    const typed = items.filter((item) => item.contentType === type);
    if (typed.length === 0) {
      continue;
    }
    sections.push(
      `*${CONTENT_TYPE_LABELS[type]}:*`,
      ...typed.map(
        (item) => `• ${item.titleAr} — ${formatPriceDzd(item.price)}`
      )
    );
  }

  return sections.join("\n");
}

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

async function showCatalogItemDetails(
  ctx: Context,
  contentId: number
): Promise<void> {
  const item = getContentItemById(contentId);
  const product = item ? getProductById(item.productId) : undefined;

  if (!item || !product) {
    await ctx.editMessageText("❌ المحتوى غير موجود.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  const text =
    buildItemIntro(item, product.nameAr) +
    "الشراء والوصول إلى المحتوى يتم عبر منصة 3M Academy، وليس داخل البوت.\n" +
    "رابط المنصة سيُضاف لاحقًا.";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: catalogItemDetailsKeyboard(item.productId),
  });
}

export async function handleAcademyDetailsInfo(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({
    text: ACADEMY_LINK_PENDING_ALERT,
    show_alert: true,
  });
}

export async function handleOrderMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }
  const products = getAllProducts();

  const text =
    "🛒 *استعراض المحتوى*\n\n" +
    "هذا البوت مساعد لمنصة 3M Academy.\n" +
    "اختر حزمة لعرض المنتجات مع اسمها ونوعها وسعرها.\n" +
    "لا يوجد شراء أو دفع داخل تيليجرام.";

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

  const items = getCatalogItems(productId);

  if (items.length === 0) {
    await ctx.editMessageText(
      `📦 *${product.nameAr}*\n\n` +
        `${product.descriptionAr}\n\n` +
        "_لا يوجد محتوى في هذه الحزمة حالياً._",
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
      buildCatalogListText(items) +
      "\n\n_اختر عنصراً لعرض التفاصيل:_",
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
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }
  await showCatalogItemDetails(ctx, contentId);
}

export async function handlePromoSkip(
  ctx: Context,
  contentId: number
): Promise<void> {
  await ctx.answerCallbackQuery({
    text: TELEGRAM_CHECKOUT_DISABLED_ALERT,
    show_alert: true,
  });
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }
  await showCatalogItemDetails(ctx, contentId);
}

export async function handlePromoHas(
  ctx: Context,
  contentId: number
): Promise<void> {
  await handlePromoSkip(ctx, contentId);
}

export async function handlePromoRetry(
  ctx: Context,
  contentId: number
): Promise<void> {
  await handlePromoSkip(ctx, contentId);
}

export async function handleCheckoutPromoInput(ctx: Context): Promise<boolean> {
  const user = ctx.from;
  if (!user) {
    return false;
  }

  clearCheckoutSession(user.id);
  return false;
}

export async function handleConfirmOrder(
  ctx: Context,
  contentId: number
): Promise<void> {
  await ctx.answerCallbackQuery({
    text: TELEGRAM_CHECKOUT_DISABLED_ALERT,
    show_alert: true,
  });
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }
  await showCatalogItemDetails(ctx, contentId);
}

export async function handlePromoConfirm(
  ctx: Context,
  contentId: number
): Promise<void> {
  await handleConfirmOrder(ctx, contentId);
}
