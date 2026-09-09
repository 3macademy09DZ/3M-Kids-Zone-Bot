import type { Context } from "grammy";
import { getProductById } from "../data/products";
import { getPurchasedOrdersByUserId } from "../database/orders";
import type { ContentType } from "../database/contentTypes";
import {
  backToMainKeyboard,
  myProductBackKeyboard,
  myProductsKeyboard,
} from "../keyboards/menus";
import {
  getAccessibleProductIds,
  userCanAccessContentItem,
  userHasProductAccess,
} from "../services/contentAccess";
import { deliverContentItem } from "../services/contentDelivery";
import {
  buildProductSectionsMessage,
  buildSectionContentMessage,
  customerProductSectionsKeyboard,
  customerSectionItemsKeyboard,
} from "../utils/productContentView";
import { logger } from "../utils/logger";

export async function handleMyProducts(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("❌ تعذّر التعرّف على المستخدم.");
    return;
  }

  try {
    const productIds = getAccessibleProductIds(user.id);

    if (productIds.length === 0) {
      await ctx.reply(
        "📦 *منتجاتي*\n\n" +
          "لا توجد لديك منتجات مشتراة حالياً.\n\n" +
          "يمكنك طلب المحتوى من القائمة الرئيسية عبر /start",
        {
          parse_mode: "Markdown",
          reply_markup: backToMainKeyboard(),
        }
      );
      return;
    }

    const lines = productIds.map((productId) => {
      const product = getProductById(productId);
      return `• ${product?.nameAr ?? productId}`;
    });

    await ctx.reply(
      "📦 *منتجاتي*\n\n" +
        "هذه هي المنتجات التي اشتريتها:\n\n" +
        lines.join("\n") +
        "\n\n_اضغط على منتج لفتح محتواه:_",
      {
        parse_mode: "Markdown",
        reply_markup: myProductsKeyboard(productIds),
      }
    );
  } catch (error) {
    logger.error("Failed to fetch purchased products", error);
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

  const productIds = getAccessibleProductIds(user.id);

  if (productIds.length === 0) {
    await ctx.editMessageText(
      "📦 *منتجاتي*\n\n" + "لا توجد لديك منتجات مشتراة حالياً.",
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard(),
      }
    );
    return;
  }

  const lines = productIds.map((productId) => {
    const product = getProductById(productId);
    return `• ${product?.nameAr ?? productId}`;
  });

  await ctx.editMessageText(
    "📦 *منتجاتي*\n\n" +
      "هذه هي المنتجات التي اشتريتها:\n\n" +
      lines.join("\n") +
      "\n\n_اضغط على منتج لفتح محتواه:_",
    {
      parse_mode: "Markdown",
      reply_markup: myProductsKeyboard(productIds),
    }
  );
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

  if (!userHasProductAccess(user.id, productId)) {
    await ctx.answerCallbackQuery({
      text: "⛔ هذا المنتج غير متاح لديك.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const product = getProductById(productId);
  if (!product) {
    await ctx.editMessageText("❌ المنتج غير موجود.", {
      reply_markup: myProductBackKeyboard(),
    });
    return;
  }

  const text = buildProductSectionsMessage(
    product.nameAr,
    product.descriptionAr,
    productId
  );

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: customerProductSectionsKeyboard(productId),
  });
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

  if (!userHasProductAccess(user.id, productId)) {
    await ctx.answerCallbackQuery({
      text: "⛔ هذا المنتج غير متاح لديك.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const product = getProductById(productId);
  if (!product) {
    await ctx.editMessageText("❌ المنتج غير موجود.", {
      reply_markup: myProductBackKeyboard(),
    });
    return;
  }

  const text = buildSectionContentMessage(
    product.nameAr,
    contentType,
    productId
  );

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: customerSectionItemsKeyboard(productId, contentType),
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
      text: "⛔ لا يمكنك الوصول إلى هذا المحتوى.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: "⏳ جاري إرسال المحتوى…" });

  try {
    const chatId = ctx.chat?.id ?? user.id;
    await deliverContentItem(ctx.api, chatId, item);
  } catch (error) {
    logger.error(`Failed to deliver content item #${contentItemId}`, error);
    await ctx.reply("❌ تعذّر إرسال المحتوى. حاول مرة أخرى لاحقاً.");
  }
}
