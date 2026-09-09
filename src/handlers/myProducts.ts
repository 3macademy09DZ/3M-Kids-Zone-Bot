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
import { deliverOwnedContentItem } from "../services/contentDelivery";
import {
  buildSectionContentMessage,
  customerSectionItemsKeyboard,
} from "../utils/productContentView";
import { logger } from "../utils/logger";

function groupVideosByPackage(videos: ProductContentItem[]): string {
  const groups: string[] = [];

  for (const product of getAllProducts()) {
    const packVideos = videos.filter((item) => item.productId === product.id);
    if (packVideos.length === 0) continue;

    groups.push(`*${product.nameAr}*`);
    for (const video of packVideos) {
      groups.push(`• ${CONTENT_TYPE_EMOJI[video.contentType]} ${video.titleAr}`);
    }
    groups.push("");
  }

  const knownIds = new Set(getAllProducts().map((product) => product.id));
  const leftover = videos.filter((item) => !knownIds.has(item.productId));
  if (leftover.length > 0) {
    groups.push("*حزم أخرى*");
    for (const video of leftover) {
      groups.push(`• ${CONTENT_TYPE_EMOJI[video.contentType]} ${video.titleAr}`);
    }
    groups.push("");
  }

  return groups.join("\n").trimEnd();
}

function buildMyProductsText(videos: ProductContentItem[]): string {
  return (
    "📦 *منتجاتي*\n\n" +
    "هذه هي العناصر التي اشتريتها:\n\n" +
    groupVideosByPackage(videos) +
    "\n\n_اضغط على عنصر لفتحه:_"
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
          "لا توجد لديك عناصر مشتراة حالياً.\n\n" +
          "يمكنك طلب فيديو أو لعبة/نشاط من القائمة الرئيسية عبر /start",
        {
          parse_mode: "Markdown",
          reply_markup: backToMainKeyboard(),
        }
      );
      return;
    }

    await ctx.reply(buildMyProductsText(videos), {
      parse_mode: "Markdown",
      reply_markup: myVideosKeyboard(videos),
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
      "📦 *منتجاتي*\n\n" + "لا توجد لديك عناصر مشتراة حالياً.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard(),
      }
    );
    return;
  }

  await ctx.editMessageText(buildMyProductsText(videos), {
    parse_mode: "Markdown",
    reply_markup: myVideosKeyboard(videos),
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

  const lines = videos.map(
    (video) => `• ${CONTENT_TYPE_EMOJI[video.contentType]} ${video.titleAr}`
  );

  await ctx.editMessageText(
    `📂 *${product.nameAr}*\n\n` +
      "العناصر المتاحة لك في هذه الحزمة:\n\n" +
      lines.join("\n") +
      "\n\n_اضغط على عنصر لفتحه:_",
    {
      parse_mode: "Markdown",
      reply_markup: myProductVideosKeyboard(videos),
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

  const text = buildSectionContentMessage(
    product.nameAr,
    contentType,
    entitled
  );

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: customerSectionItemsKeyboard(productId, contentType, entitled),
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
      text: "⛔ هذا المحتوى غير متاح في حسابك. يجب شراؤه أولًا.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: "⏳ جاري إرسال المحتوى…" });

  try {
    const chatId = ctx.chat?.id ?? user.id;
    const result = await deliverOwnedContentItem(
      ctx.api,
      chatId,
      user.id,
      item
    );

    if (result === "denied") {
      await ctx.reply(
        "⛔ هذا المحتوى غير متاح في حسابك. يمكنك طلبه من «🛒 طلب المحتوى»."
      );
    }
  } catch (error) {
    logger.error(`Failed to deliver content item #${contentItemId}`, error);
    await ctx.reply("❌ تعذّر إرسال المحتوى. حاول مرة أخرى لاحقاً.");
  }
}
