import type { Context } from "grammy";
import { formatContactLink, getEnvConfig } from "../config/env";
import type { EnvConfig } from "../config/env";
import { isContactActive, resolveAppSettings } from "../config/appSettings";
import { backToMainKeyboard, mainMenuKeyboard } from "../keyboards/menus";
import { clearCheckoutSession } from "../state/checkoutSession";
import { clearSupportSession } from "../state/supportSession";

export const WELCOME_MESSAGE =
  "👋 أهلاً وسهلاً بك في *3M Kids Zone*!\n\n" +
  "نحن نقدّم محتوى تعليمي وتفاعلي مميز للأطفال.\n\n" +
  "اختر أحد الخيارات أدناه للبدء:";

function mainMenu() {
  const settings = resolveAppSettings(getEnvConfig());
  return mainMenuKeyboard({
    showContact: settings.contactEnabled,
  });
}

export async function handleStart(ctx: Context): Promise<void> {
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
    clearSupportSession(ctx.from.id);
  }
  await ctx.reply(WELCOME_MESSAGE, {
    parse_mode: "Markdown",
    reply_markup: mainMenu(),
  });
}

export async function handleBackToMain(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
    clearSupportSession(ctx.from.id);
  }
  await ctx.editMessageText(WELCOME_MESSAGE, {
    parse_mode: "Markdown",
    reply_markup: mainMenu(),
  });
}

export async function handleAboutContent(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const text =
    "🎓 *التعرف على المحتوى*\n\n" +
    "يوفر *3M Kids Zone* محتوى تعليمي وتفاعلي مصمّم خصيصاً للأطفال، " +
    "يجمع بين التعلّم والمتعة في بيئة آمنة.\n\n" +
    "📌 *يشمل المحتوى:*\n" +
    "• فيديوهات تعليمية تفاعلية\n" +
    "• أنشطة تحفّز التفكير والإبداع\n" +
    "• محتوى مناسب لمختلف الأعمار\n\n" +
    "للحصول على المحتوى، اختر «🛒 طلب المحتوى» من القائمة.";

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: backToMainKeyboard(),
  });
}

export async function handleContact(
  ctx: Context,
  config: EnvConfig
): Promise<void> {
  await ctx.answerCallbackQuery();

  const settings = resolveAppSettings(config);
  const contactLink = formatContactLink(settings.contactUsername);

  let text =
    "📞 *التواصل معنا*\n\n" +
    "يسعدنا تواصلك معنا لأي استفسار أو مساعدة.";

  if (isContactActive(settings) && contactLink && settings.contactUsername) {
    const displayName = settings.contactUsername.startsWith("@")
      ? settings.contactUsername
      : `@${settings.contactUsername}`;
    text += `\n\n👤 ${displayName}\n🔗 [اضغط هنا للتواصل](${contactLink})`;
  } else {
    text +=
      "\n\n⚠️ معلومات التواصل غير مُعدّة حالياً.";
  }

  await ctx.editMessageText(text, {
    parse_mode: "Markdown",
    reply_markup: backToMainKeyboard(),
    link_preview_options: { is_disabled: true },
  });
}
