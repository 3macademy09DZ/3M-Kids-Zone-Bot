import type { Context } from "grammy";
import { getAllProducts, getProductById } from "../data/products";
import {
  CONTENT_TYPE_EMOJI,
  type ContentType,
  type ProductContentItem,
} from "../database/contentTypes";
import {
  backToMainKeyboard,
  myProductBackKeyboard,
  myProductVideosKeyboard,
  myVideosKeyboard,
} from "../keyboards/menus";
import {
  getAccessibleVideos,
  getAccessibleVideosInProduct,
  userCanAccessContentItem,
  userHasEntitledVideosInProduct,
} from "../services/contentAccess";
import { ACADEMY_LINK_PENDING_ALERT } from "../config/academy";
import {
  buildSectionContentMessage,
  customerSectionItemsKeyboard,
} from "../utils/productContentView";
import { logger } from "../utils/logger";
import {
  getOwnedContentPriceMap,
  resolveOwnedItemPrice,
} from "../utils/ownedPrice";
import { formatPriceDzd } from "../utils/price";

function withOwnedPrices<T extends { id: number; price?: number | null }>(
  items: T[],
  ownedPrices: Map<number, number>
): Array<T & { price: number | null }> {
  return items.map((item) => ({
    ...item,
    price: resolveOwnedItemPrice(item, ownedPrices),
  }));
}

function groupVideosByPackage(videos: Array<ProductContentItem & { price: number | null }>): string {
  const groups: string[] = [];

  for (const product of getAllProducts()) {
    const packVideos = videos.filter((item) => item.productId === product.id);
    if (packVideos.length === 0) continue;

    groups.push(`*${product.nameAr}*`);
    for (const video of packVideos) {
      groups.push(
        `• ${CONTENT_TYPE_EMOJI[video.contentType]} ${video.titleAr} — ${formatPriceDzd(video.price)}`
      );
    }
    groups.push("");
  }

  const knownIds = new Set(getAllProducts().map((product) => product.id));
  const leftover = videos.filter((item) => !knownIds.has(item.productId));
  if (leftover.length > 0) {
    groups.push("*حزم أخرى*");
    for (const video of leftover) {
      groups.push(
        `• ${CONTENT_TYPE_EMOJI[video.contentType]} ${video.titleAr} — ${formatPriceDzd(video.price)}`
      );
    }
    groups.push("");
  }

  return groups.join("\n").trimEnd();
}

function buildMyProductsText(
  videos: Array<ProductContentItem & { price: number | null }>
): string {
  return (
    "📦 *منتجاتي*\n\n" +
    "هذه هي العناصر المرتبطة بحسابك:\n\n" +
    groupVideosByPackage(videos) +
    "\n\n_المحتوى لا يُفتح من تيليجرام. الوصول إليه سيكون عبر منصة 3M Academy._"
  );
}

export async function handleMyProductsOpen(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await handleMyProducts(ctx);
}

export async function handleMyProducts(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("❌ تعذّر التعرّف على المستخدم.");
    return;
  }

  try {
    const videos = getAccessibleVideos(user.id);

    if (videos.length === 0) {
      await ctx.reply(
        "📦 *منتجاتي*\n\n" +
          "لا توجد لديك عناصر مرتبطة بحسابك حالياً.\n\n" +
          "يمكنك تصفّح المنتجات من القائمة الرئيسية. الشراء سيتم عبر منصة 3M Academy.",
        {
          parse_mode: "Markdown",
          reply_markup: backToMainKeyboard(),
        }
      );
      return;
    }

    const displayItems = withOwnedPrices(videos, getOwnedContentPriceMap(user.id));

    await ctx.reply(buildMyProductsText(displayItems), {
      parse_mode: "Markdown",
      reply_markup: myVideosKeyboard(displayItems),
    });
  } catch (error) {
    logger.error("Failed to fetch purchased videos", error);
    await ctx.reply(
      "❌ حدث خطأ أثناء جلب منتجاتك. يُرجى المحاولة لاحقاً.",
      { reply_markup: backToMainKeyboard() }
    );
  }
}

export async function handleMyProductsBack(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const user = ctx.from;
  if (!user) return;

  const videos = getAccessibleVideos(user.id);

  if (videos.length === 0) {
    await ctx.editMessageText(
      "📦 *منتجاتي*\n\n" + "لا توجد لديك عناصر مرتبطة بحسابك حالياً.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard(),
      }
    );
    return;
  }

  const displayItems = withOwnedPrices(videos, getOwnedContentPriceMap(user.id));

  await ctx.editMessageText(buildMyProductsText(displayItems), {
    parse_mode: "Markdown",
    reply_markup: myVideosKeyboard(displayItems),
  });
}

export async function handleMyProductOpen(
  ctx: Context,
  productId: string
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.answerCallbackQuery();
    return;
  }

  const videos = getAccessibleVideosInProduct(user.id, productId);

  if (!userHasEntitledVideosInProduct(user.id, productId) || videos.length === 0) {
    await ctx.answerCallbackQuery({
      text: "⛔ لا توجد عناصر متاحة لك في هذه الحزمة.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const product = getProductById(productId);
  if (!product) {
    await ctx.editMessageText("❌ الحزمة غير موجودة.", {
      reply_markup: myProductBackKeyboard(),
    });
    return;
  }

  const displayItems = withOwnedPrices(videos, getOwnedContentPriceMap(user.id));
  const lines = displayItems.map(
    (video) =>
      `• ${CONTENT_TYPE_EMOJI[video.contentType]} ${video.titleAr} — ${formatPriceDzd(video.price)}`
  );

  await ctx.editMessageText(
    `📂 *${product.nameAr}*\n\n` +
      "العناصر المرتبطة بحسابك في هذه الحزمة:\n\n" +
      lines.join("\n") +
      "\n\n_المحتوى لا يُفتح من تيليجرام. الوصول إليه سيكون عبر منصة 3M Academy._",
    {
      parse_mode: "Markdown",
      reply_markup: myProductVideosKeyboard(displayItems),
    }
  );
}

export async function handleMyContentSection(
  ctx: Context,
  productId: string,
  contentType: ContentType
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.answerCallbackQuery();
    return;
  }

  const entitled = getAccessibleVideosInProduct(user.id, productId).filter(
    (item) => item.contentType === contentType
  );

  if (entitled.length === 0) {
    await ctx.answerCallbackQuery({
      text: "⛔ لا يوجد محتوى متاح لك في هذا القسم.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const product = getProductById(productId);
  if (!product) {
    await ctx.editMessageText("❌ الحزمة غير موجودة.", {
      reply_markup: myProductBackKeyboard(),
    });
    return;
  }

  const displayItems = withOwnedPrices(
    entitled,
    getOwnedContentPriceMap(user.id)
  );

  const text = buildSectionContentMessage(
    product.nameAr,
    contentType,
    displayItems
  );

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: customerSectionItemsKeyboard(
      productId,
      contentType,
      displayItems
    ),
  });
}

export async function handleMyContentItemOpen(
  ctx: Context,
  contentItemId: number
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.answerCallbackQuery();
    return;
  }

  const { allowed, item } = userCanAccessContentItem(user.id, contentItemId);

  if (!allowed || !item) {
    await ctx.answerCallbackQuery({
      text: "⛔ هذا المحتوى غير مرتبط بحسابك في البوت.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({
    text: ACADEMY_LINK_PENDING_ALERT,
    show_alert: true,
  });
}
