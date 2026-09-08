import type { Context } from "grammy";
import { getAllProducts, getProductById } from "../data/products";
import {
  backToMainKeyboard,
  confirmOrderKeyboard,
  productListKeyboard,
} from "../keyboards/menus";
import { createOrder } from "../database/orders";
import { logger } from "../utils/logger";

export async function handleOrderMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const products = getAllProducts();

  const text =
    "🛒 *طلب المحتوى*\n\n" +
    "اختر الحزمة التي ترغب بطلبها:\n\n" +
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

  const text =
    `📦 *${product.nameAr}*\n\n` +
    `${product.descriptionAr}\n\n` +
    "هل ترغب بتأكيد هذا الطلب؟";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: confirmOrderKeyboard(product.id),
  });
}

export async function handleConfirmOrder(
  ctx: Context,
  productId: string
): Promise<void> {
  await ctx.answerCallbackQuery();
  const product = getProductById(productId);
  const user = ctx.from;

  if (!product || !user) {
    await ctx.editMessageText("❌ تعذّر إتمام الطلب. حاول مرة أخرى.", {
      reply_markup: backToMainKeyboard(),
    });
    return;
  }

  try {
    const order = createOrder({
      telegramUserId: user.id,
      telegramUsername: user.username ?? null,
      productId: product.id,
    });

    logger.info(
      `New order #${order.id} from user ${user.id} for product ${product.id}`
    );

    const text =
      "✅ *تم استلام طلبك بنجاح!*\n\n" +
      `📋 رقم الطلب: \`${order.id}\`\n` +
      `📦 المنتج: ${product.nameAr}\n` +
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
