import type { Context } from "grammy";
import type { InlineKeyboard } from "grammy";
import type { EnvConfig } from "../config/env";
import { resolveAppSettings } from "../config/appSettings";
import { setSettingOverride, SETTINGS_KEYS } from "../database/settings";
import {
  formatUserDisplayName,
  formatUsernameHandle,
  getTelegramUserById,
} from "../database/users";
import {
  adminSettingsBackKeyboard,
  adminSettingsCancelKeyboard,
  adminSettingsChannelKeyboard,
  adminSettingsContactKeyboard,
  adminSettingsHubKeyboard,
  adminSettingsPaymentKeyboard,
} from "../keyboards/menus";
import type { InviteLinkService } from "../services/inviteLink";
import {
  clearAdminSettingsSession,
  getAdminSettingsSession,
  setAdminSettingsSession,
  type AdminSettingsEditField,
} from "../state/adminSettingsSession";
import { clearAdminContentSession } from "../state/adminContentSession";
import { clearAdminPromoSession } from "../state/adminPromoSession";
import { logger } from "../utils/logger";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function enabledLabel(enabled: boolean): string {
  return enabled ? "مفعّل" : "غير مفعّل";
}

function formatContactDisplay(username: string | undefined): string {
  if (!username) {
    return "غير مُعدّ";
  }
  return username.startsWith("@") ? username : `@${username}`;
}

function normalizeContactUsername(raw: string): string | null {
  const clean = raw.trim().replace(/^@+/, "").replace(/^https?:\/\/t\.me\//i, "");
  if (!clean || !/^[A-Za-z0-9_]{5,32}$/.test(clean)) {
    return null;
  }
  return clean;
}

function adminDisplayName(config: EnvConfig): string {
  const profile = getTelegramUserById(config.adminTelegramId);
  return formatUserDisplayName(profile, config.adminTelegramId);
}

async function presentSettingsText(
  ctx: Context,
  text: string,
  extra: {
    parse_mode?: "HTML" | "Markdown";
    reply_markup?: InlineKeyboard;
  }
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch {
      // Fall through when the previous message cannot be edited.
    }
  }
  await ctx.reply(text, extra);
}

async function showHub(
  ctx: Context,
  config: EnvConfig,
  inviteLinkService: InviteLinkService
): Promise<void> {
  const settings = resolveAppSettings(config);
  const adminName = adminDisplayName(config);

  await presentSettingsText(
    ctx,
    "⚙️ <b>الإعدادات</b>\n\n" +
      `📣 القناة: ${enabledLabel(settings.channelEnabled)}\n` +
      `☎️ التواصل: ${enabledLabel(settings.contactEnabled)}\n` +
      `🔗 روابط الدعوة: ${inviteLinkService.isReady() ? "جاهز" : "غير جاهز"}\n` +
      `💳 CCP / BaridiMob: ${enabledLabel(settings.ccpEnabled)}\n` +
      `💳 RedotPay: ${enabledLabel(settings.redotpayEnabled)}\n` +
      `👤 المسؤول: ${escapeHtml(adminName)}`,
    {
      parse_mode: "HTML",
      reply_markup: adminSettingsHubKeyboard(),
    }
  );
}

async function showChannel(ctx: Context, config: EnvConfig): Promise<void> {
  const settings = resolveAppSettings(config);
  const channelId = settings.channelId ?? "غير مُعدّ";

  await presentSettingsText(
    ctx,
    "📣 <b>إعدادات القناة</b>\n\n" +
      `المعرّف الحالي:\n<code>${escapeHtml(channelId)}</code>\n\n` +
      `الحالة: ${enabledLabel(settings.channelEnabled)}`,
    {
      parse_mode: "HTML",
      reply_markup: adminSettingsChannelKeyboard(settings.channelEnabled),
    }
  );
}

async function showContact(ctx: Context, config: EnvConfig): Promise<void> {
  const settings = resolveAppSettings(config);

  await presentSettingsText(
    ctx,
    "☎️ <b>إعدادات التواصل</b>\n\n" +
      `اسم التواصل الحالي: ${escapeHtml(formatContactDisplay(settings.contactUsername))}\n` +
      `الحالة: ${enabledLabel(settings.contactEnabled)}`,
    {
      parse_mode: "HTML",
      reply_markup: adminSettingsContactKeyboard(settings.contactEnabled),
    }
  );
}

async function showPayment(ctx: Context, config: EnvConfig): Promise<void> {
  const settings = resolveAppSettings(config);

  await presentSettingsText(
    ctx,
    "💳 <b>إعدادات الدفع</b>\n\n" +
      `${settings.ccpEnabled ? "✅" : "❌"} CCP / BaridiMob ${enabledLabel(settings.ccpEnabled)}\n` +
      `${settings.redotpayEnabled ? "✅" : "❌"} RedotPay ${enabledLabel(settings.redotpayEnabled)}\n\n` +
      "لا تُعرض أرقام الحسابات في هذه الشاشة.",
    {
      parse_mode: "HTML",
      reply_markup: adminSettingsPaymentKeyboard({
        ccpEnabled: settings.ccpEnabled,
        redotpayEnabled: settings.redotpayEnabled,
      }),
    }
  );
}

async function showAfterSave(
  ctx: Context,
  config: EnvConfig,
  field: AdminSettingsEditField
): Promise<void> {
  if (field === "channel_id") {
    await showChannel(ctx, config);
    return;
  }
  if (field === "contact_username") {
    await showContact(ctx, config);
    return;
  }
  await showPayment(ctx, config);
}

export async function handleAdminSettings(
  ctx: Context,
  config: EnvConfig,
  inviteLinkService: InviteLinkService
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearAdminSettingsSession(ctx.from.id);
  }
  await showHub(ctx, config, inviteLinkService);
}

export async function handleAdminSettingsChannel(
  ctx: Context,
  config: EnvConfig
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showChannel(ctx, config);
}

export async function handleAdminSettingsContact(
  ctx: Context,
  config: EnvConfig
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showContact(ctx, config);
}

export async function handleAdminSettingsPayment(
  ctx: Context,
  config: EnvConfig
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showPayment(ctx, config);
}

export async function handleAdminSettingsAdmin(
  ctx: Context,
  config: EnvConfig
): Promise<void> {
  await ctx.answerCallbackQuery();
  const profile = getTelegramUserById(config.adminTelegramId);
  const name = formatUserDisplayName(profile, config.adminTelegramId);
  const username = formatUsernameHandle(profile?.username);

  await presentSettingsText(
    ctx,
    "👤 <b>بيانات المسؤول</b>\n\n" +
      `👤 الاسم: ${escapeHtml(name)}\n` +
      `🔗 Username: ${username ? escapeHtml(username) : "غير متوفر"}\n` +
      `🆔 Telegram ID: <code>${config.adminTelegramId}</code>\n\n` +
      "لا يمكن تعديل رمز البوت أو معرّف المسؤول من هنا.",
    {
      parse_mode: "HTML",
      reply_markup: adminSettingsBackKeyboard(),
    }
  );
}

export async function handleAdminSettingsStartEdit(
  ctx: Context,
  field: AdminSettingsEditField
): Promise<void> {
  const adminId = ctx.from?.id;
  if (!adminId) {
    return;
  }

  await ctx.answerCallbackQuery();
  clearAdminContentSession(adminId);
  clearAdminPromoSession(adminId);
  setAdminSettingsSession(adminId, { field });

  const prompts: Record<AdminSettingsEditField, string> = {
    channel_id:
      "✏️ أرسل الآن <b>معرّف القناة</b> الجديد.\n" +
      "مثال: <code>-1001234567890</code>",
    contact_username:
      "✏️ أرسل الآن <b>اسم مستخدم التواصل</b>.\n" +
      "يمكنك إرساله مع @ أو بدونه.\n" +
      "مثال: <code>3MKidsZone</code>",
    ccp_account_info:
      "✏️ أرسل الآن <b>معلومات CCP</b> الجديدة.\n" +
      "مثال: <code>123456789 clé 12</code>",
    baridimob_rip: "✏️ أرسل الآن <b>رقم RIP BaridiMob</b> الجديد.",
    payment_account_name: "✏️ أرسل الآن <b>اسم صاحب الحساب</b>.",
    redotpay_payment_info: "✏️ أرسل الآن <b>معلومات RedotPay</b> الجديدة.",
  };

  await presentSettingsText(ctx, prompts[field], {
    parse_mode: "HTML",
    reply_markup: adminSettingsCancelKeyboard(),
  });
}

export async function handleAdminSettingsCancel(
  ctx: Context,
  config: EnvConfig,
  inviteLinkService: InviteLinkService
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const field = adminId ? getAdminSettingsSession(adminId)?.field : undefined;
  if (adminId) {
    clearAdminSettingsSession(adminId);
  }

  if (field === "channel_id") {
    await showChannel(ctx, config);
    return;
  }
  if (field === "contact_username") {
    await showContact(ctx, config);
    return;
  }
  if (
    field === "ccp_account_info" ||
    field === "baridimob_rip" ||
    field === "payment_account_name" ||
    field === "redotpay_payment_info"
  ) {
    await showPayment(ctx, config);
    return;
  }

  await showHub(ctx, config, inviteLinkService);
}

export async function handleAdminSettingsToggle(
  ctx: Context,
  config: EnvConfig,
  key:
    | typeof SETTINGS_KEYS.CHANNEL_ENABLED
    | typeof SETTINGS_KEYS.CONTACT_ENABLED
    | typeof SETTINGS_KEYS.CCP_ENABLED
    | typeof SETTINGS_KEYS.REDOTPAY_ENABLED,
  enabled: boolean,
  screen: "channel" | "contact" | "payment"
): Promise<void> {
  setSettingOverride(key, enabled ? "1" : "0");
  logger.info("Admin setting flag updated");
  await ctx.answerCallbackQuery({ text: "✅ تم حفظ الإعداد بنجاح" });

  if (screen === "channel") {
    await showChannel(ctx, config);
    return;
  }
  if (screen === "contact") {
    await showContact(ctx, config);
    return;
  }
  await showPayment(ctx, config);
}

export async function handleAdminSettingsInput(
  ctx: Context,
  config: EnvConfig
): Promise<boolean> {
  const adminId = ctx.from?.id;
  const message = ctx.message;
  if (!adminId || !message) {
    return false;
  }

  const session = getAdminSettingsSession(adminId);
  if (!session) {
    return false;
  }

  const raw = message.text?.trim() ?? "";
  if (!raw) {
    await ctx.reply("❌ أرسل القيمة كنص، أو اضغط إلغاء.", {
      reply_markup: adminSettingsCancelKeyboard(),
    });
    return true;
  }

  try {
    if (session.field === "channel_id") {
      setSettingOverride(SETTINGS_KEYS.CHANNEL_ID, raw);
    } else if (session.field === "contact_username") {
      const username = normalizeContactUsername(raw);
      if (!username) {
        await ctx.reply(
          "❌ اسم المستخدم غير صالح.\nأرسل اسمًا مثل <code>3MKidsZone</code>.",
          {
            parse_mode: "HTML",
            reply_markup: adminSettingsCancelKeyboard(),
          }
        );
        return true;
      }
      setSettingOverride(SETTINGS_KEYS.CONTACT_USERNAME, username);
    } else if (session.field === "ccp_account_info") {
      setSettingOverride(SETTINGS_KEYS.CCP_ACCOUNT_INFO, raw);
    } else if (session.field === "baridimob_rip") {
      setSettingOverride(SETTINGS_KEYS.BARIDIMOB_RIP, raw);
    } else if (session.field === "payment_account_name") {
      setSettingOverride(SETTINGS_KEYS.PAYMENT_ACCOUNT_NAME, raw);
    } else if (session.field === "redotpay_payment_info") {
      setSettingOverride(SETTINGS_KEYS.REDOTPAY_PAYMENT_INFO, raw);
    }
  } catch {
    logger.error("Failed to save admin setting");
    await ctx.reply("❌ تعذّر حفظ الإعداد. حاول مرة أخرى.", {
      reply_markup: adminSettingsCancelKeyboard(),
    });
    return true;
  }

  logger.info("Admin setting value updated");
  clearAdminSettingsSession(adminId);
  await ctx.reply("✅ تم حفظ الإعداد بنجاح");
  await showAfterSave(ctx, config, session.field);
  return true;
}
