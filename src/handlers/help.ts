import type { Context } from "grammy";
import type { EnvConfig } from "../config/env";
import { paymentMethodOptions, resolveAppSettings } from "../config/appSettings";
import { helpMenuKeyboard, helpTopicBackKeyboard } from "../keyboards/menus";

const HELP_MENU_TEXT =
  "❓ *المساعدة*\n\n" +
  "اختر السؤال المناسب لمعرفة الخطوات بسرعة:";

const HELP_BUY_TEXT =
  "🛒 *كيف أشتري؟*\n\n" +
  "اتبع هذه الخطوات داخل البوت:\n\n" +
  "1. من القائمة الرئيسية اضغط «🛒 طلب المحتوى».\n" +
  "2. اختر الحزمة، ثم اختر الفيديو أو اللعبة/النشاط.\n" +
  "3. أكّد الطلب.\n" +
  "4. أكمل الدفع وأرسل صورة إثبات التحويل.\n" +
  "5. بعد قبول الدفع يظهر المحتوى في «📦 منتجاتي».";

const HELP_PURCHASES_TEXT =
  "📦 *أين أجد مشترياتي؟*\n\n" +
  "بعد قبول الدفع، افتح «📦 منتجاتي» من القائمة الرئيسية، أو أرسل الأمر /myproducts.\n\n" +
  "ستجد العناصر التي اشتريتها مرتّبة حسب الحزمة. اضغط على العنصر لفتحه.\n\n" +
  "إذا لم يظهر المحتوى بعد، فطلبك ما زال قيد المراجعة.";

const HELP_PROMO_TEXT =
  "🎟️ *كيف أستخدم كود الخصم؟*\n\n" +
  "1. ابدأ الشراء واختر المحتوى المطلوب.\n" +
  "2. اضغط «🎟️ لدي كود تخفيض».\n" +
  "3. أرسل الكود كنص داخل البوت.\n" +
  "4. راجع السعر بعد التخفيض ثم أكّد الطلب.\n\n" +
  "إذا لم يكن لديك كود، اضغط «متابعة بدون كود».\n" +
  "يُستخدم الكود أثناء إنشاء الطلب فقط، وليس بعد الدفع.";

function buildPayHelpText(config: EnvConfig): string {
  const methods = paymentMethodOptions(resolveAppSettings(config));
  const available: string[] = [];
  if (methods.ccp) {
    available.push("• CCP / BaridiMob");
  }
  if (methods.redotpay) {
    available.push("• RedotPay");
  }

  const methodsBlock =
    available.length > 0
      ? `طرق الدفع المتاحة حالياً:\n${available.join("\n")}`
      : "⚠️ طرق الدفع غير مفعّلة حالياً. يمكنك العودة لاحقاً أو استخدام «❓ لدي مشكلة».";

  return (
    "💳 *كيف أدفع؟*\n\n" +
    "بعد تأكيد الطلب:\n\n" +
    "1. اختر طريقة الدفع الظاهرة لك.\n" +
    "2. نفّذ التحويل حسب التعليمات داخل البوت.\n" +
    "3. أرسل *صورة إثبات الدفع* (Screenshot).\n" +
    "4. انتظر مراجعة الإدارة. سيصلك إشعار عند القبول.\n\n" +
    `${methodsBlock}\n\n` +
    "لا ترسل المبلغ خارج الخطوات الظاهرة في البوت."
  );
}

async function showHelpText(ctx: Context, text: string): Promise<void> {
  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: helpTopicBackKeyboard(),
  });
}

export async function handleHelpMenu(ctx: Context): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageText(HELP_MENU_TEXT, {
        parse_mode: "Markdown",
        reply_markup: helpMenuKeyboard(),
      });
      return;
    } catch {
      // Fall through to a new message when the previous one cannot be edited.
    }
  }

  await ctx.reply(HELP_MENU_TEXT, {
    parse_mode: "Markdown",
    reply_markup: helpMenuKeyboard(),
  });
}

export async function handleHelpBuy(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelpText(ctx, HELP_BUY_TEXT);
}

export async function handleHelpPay(
  ctx: Context,
  config: EnvConfig
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelpText(ctx, buildPayHelpText(config));
}

export async function handleHelpPurchases(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelpText(ctx, HELP_PURCHASES_TEXT);
}

export async function handleHelpPromo(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelpText(ctx, HELP_PROMO_TEXT);
}
