import type { Context } from "grammy";
import type { EnvConfig } from "../config/env";
import { helpMenuKeyboard, helpTopicBackKeyboard } from "../keyboards/menus";

const HELP_MENU_TEXT =
  "❓ *المساعدة*\n\n" +
  "اختر السؤال المناسب لمعرفة الخطوات بسرعة:";

const HELP_BUY_TEXT =
  "🛒 *كيف أحصل على المحتوى؟*\n\n" +
  "هذا البوت مساعد لمنصة 3M Academy.\n\n" +
  "1. من القائمة الرئيسية اضغط «🛒 طلب المحتوى».\n" +
  "2. اختر الحزمة ثم العنصر لعرض اسمه ونوعه وسعره.\n" +
  "3. اضغط «🌐 عرض التفاصيل في 3M Academy» عند توفر رابط المنصة.\n\n" +
  "لا يوجد شراء أو دفع داخل تيليجرام. الشراء والوصول إلى المحتوى سيتم عبر منصة 3M Academy.";

const HELP_PAY_TEXT =
  "💳 *كيف أدفع؟*\n\n" +
  "الدفع لم يعد متاحاً داخل تيليجرام.\n" +
  "لن تظهر تعليمات CCP أو BaridiMob أو RedotPay داخل البوت، ولا يُطلب إثبات دفع هنا.\n\n" +
  "سيتم إتمام الشراء والدفع لاحقاً عبر منصة 3M Academy.";

const HELP_PURCHASES_TEXT =
  "📦 *أين أجد منتجاتي؟*\n\n" +
  "افتح «📦 منتجاتي» من القائمة الرئيسية، أو أرسل الأمر /myproducts.\n\n" +
  "ستظهر العناصر المرتبطة بحسابك إن وُجدت. المحتوى المدفوع لا يُفتح ولا يُرسل من داخل البوت؛ الوصول إليه سيكون عبر منصة 3M Academy.";

const HELP_PROMO_TEXT =
  "🎟️ *أكواد الخصم*\n\n" +
  "لا تُستخدم أكواد الخصم أثناء تصفّح المنتجات داخل تيليجرام.\n\n" +
  "إن توفّرت أكواد لاحقاً فسيكون ذلك عبر منصة 3M Academy.";

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
  _config: EnvConfig
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelpText(ctx, HELP_PAY_TEXT);
}

export async function handleHelpPurchases(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelpText(ctx, HELP_PURCHASES_TEXT);
}

export async function handleHelpPromo(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await showHelpText(ctx, HELP_PROMO_TEXT);
}
