import type { Context } from "grammy";
import { TELEGRAM_CHECKOUT_DISABLED_ALERT } from "../config/academy";
import { getContentItemById } from "../database/content";
import { backToMainKeyboard } from "../keyboards/menus";
import { clearCheckoutSession } from "../state/checkoutSession";
import {
  handleCatalogAcademyOpen,
  handleCatalogItemSelect,
  handleCatalogOrderMenu,
  handleCatalogSubjectSelect,
  handleCatalogTypeSelect,
  handleCatalogYearSelect,
} from "./catalogBrowse";

export { handleCatalogOrderMenu as handleOrderMenu };
export { handleCatalogYearSelect };
export { handleCatalogSubjectSelect };
export { handleCatalogTypeSelect };
export { handleCatalogItemSelect as handleVideoSelect };
export { handleCatalogAcademyOpen };

export async function handleAcademyDetailsInfo(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery({
    text: "رابط هذا المحتوى على منصة 3M Academy سيضاف لاحقًا.",
    show_alert: true,
  });
}

export async function handleProductSelect(
  ctx: Context,
  _productId: string
): Promise<void> {
  await handleCatalogOrderMenu(ctx);
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
  await handleCatalogItemSelect(ctx, contentId);
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

  const item = getContentItemById(contentId);
  if (item?.isCatalogItem) {
    await handleCatalogItemSelect(ctx, contentId);
    return;
  }

  await ctx.editMessageText("❌ المحتوى غير موجود.", {
    reply_markup: backToMainKeyboard(),
  });
}

export async function handlePromoConfirm(
  ctx: Context,
  contentId: number
): Promise<void> {
  await handleConfirmOrder(ctx, contentId);
}
