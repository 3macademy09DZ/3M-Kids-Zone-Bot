import type { Context } from "grammy";
import { getProductById } from "../data/products";
import { getPurchasedOrdersByUserId } from "../database/orders";
import { backToMainKeyboard } from "../keyboards/menus";
import { logger } from "../utils/logger";

export async function handleMyProducts(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply("❌ تعذّر التعرّف على المستخدم.");
    return;
  }

  try {
    const orders = getPurchasedOrdersByUserId(user.id);

    if (orders.length === 0) {
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

    const seenProductIds = new Set<string>();
    const lines: string[] = [];

    for (const order of orders) {
      if (seenProductIds.has(order.productId)) continue;
      seenProductIds.add(order.productId);

      const product = getProductById(order.productId);
      const name = product?.nameAr ?? order.productId;
      lines.push(`• ${name}`);
    }

    await ctx.reply(
      "📦 *منتجاتي*\n\n" +
        "هذه هي المنتجات التي اشتريتها:\n\n" +
        lines.join("\n"),
      {
        parse_mode: "Markdown",
        reply_markup: backToMainKeyboard(),
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
