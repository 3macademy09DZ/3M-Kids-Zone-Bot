import type { Context, InlineKeyboard } from "grammy";
import {
  createPromoCode,
  deleteOrDeactivatePromo,
  getPromoByCode,
  getPromoById,
  listPromoCodes,
  setPromoActive,
  type PromoCode,
} from "../database/promos";
import {
  adminPromoCancelKeyboard,
  adminPromoDeleteConfirmKeyboard,
  adminPromoExpiryKeyboard,
  adminPromoHubKeyboard,
  adminPromoListKeyboard,
  adminPromoMaxUsesKeyboard,
  adminPromoTypeKeyboard,
  adminPromoViewKeyboard,
} from "../keyboards/menus";
import { clearAdminContentSession } from "../state/adminContentSession";
import {
  clearAdminPromoSession,
  getAdminPromoSession,
  setAdminPromoSession,
  type AdminPromoSession,
} from "../state/adminPromoSession";
import { formatPriceDzd, parsePriceDzd } from "../utils/price";
import {
  algiersTodayYmd,
  normalizePromoCodeInput,
  parsePercentValue,
  parsePositiveInt,
  parsePromoExpiryDate,
  type PromoDiscountType,
} from "../utils/promoPrice";
import { logger } from "../utils/logger";

const PROMO_PAGE_SIZE = 5;

function discountTypeLabel(type: PromoDiscountType): string {
  return type === "percent" ? "نسبة مئوية %" : "مبلغ ثابت بالدينار";
}

function formatDiscountValue(promo: PromoCode): string {
  return promo.discountType === "percent"
    ? `${promo.discountValue}%`
    : formatPriceDzd(promo.discountValue);
}

function formatMaxUses(promo: PromoCode): string {
  const max = promo.maxUses == null ? "غير محدود" : String(promo.maxUses);
  return `${promo.usedCount} / ${max}`;
}

function formatExpiry(promo: PromoCode): string {
  return promo.expiresAt ?? "بدون تاريخ انتهاء";
}

function formatPromoBlock(promo: PromoCode): string {
  return (
    `🎟️ \`${promo.code}\`\n` +
    `نوع التخفيض: ${discountTypeLabel(promo.discountType)}\n` +
    `القيمة: ${formatDiscountValue(promo)}\n` +
    `عدد الاستعمالات الحالي / الحد الأقصى: ${formatMaxUses(promo)}\n` +
    `تاريخ الانتهاء: ${formatExpiry(promo)}\n` +
    `الحالة: ${promo.isActive ? "Active" : "Inactive"}`
  );
}

async function presentPromoText(
  ctx: Context,
  text: string,
  extra: {
    parse_mode?: "Markdown" | "HTML";
    reply_markup?: InlineKeyboard;
  }
): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch {
      // Fall through to a new message when the previous one cannot be edited.
    }
  }
  await ctx.reply(text, extra);
}

async function showPromoHub(ctx: Context): Promise<void> {
  const adminId = ctx.from?.id;
  if (adminId) {
    clearAdminPromoSession(adminId);
  }

  await presentPromoText(ctx, "🎟️ *أكواد التخفيض*\n\nاختر ما تريد القيام به:", {
    parse_mode: "Markdown",
    reply_markup: adminPromoHubKeyboard(),
  });
}

async function showPromoList(ctx: Context, page = 0): Promise<void> {
  const adminId = ctx.from?.id;
  if (adminId) {
    clearAdminPromoSession(adminId);
  }

  const promos = listPromoCodes();
  if (promos.length === 0) {
    await presentPromoText(ctx, "📋 *الأكواد الحالية*\n\nلا توجد أكواد حالياً.", {
      parse_mode: "Markdown",
      reply_markup: adminPromoHubKeyboard(),
    });
    return;
  }

  const totalPages = Math.max(1, Math.ceil(promos.length / PROMO_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const slice = promos.slice(
    safePage * PROMO_PAGE_SIZE,
    (safePage + 1) * PROMO_PAGE_SIZE
  );
  const pageNote =
    totalPages > 1 ? `\n\nصفحة ${safePage + 1} من ${totalPages}` : "";

  await presentPromoText(
    ctx,
    "📋 *الأكواد الحالية*\n\n" +
      slice.map(formatPromoBlock).join("\n\n") +
      pageNote,
    {
      parse_mode: "Markdown",
      reply_markup: adminPromoListKeyboard({
        promos: slice,
        page: safePage,
        totalPages,
      }),
    }
  );
}

export async function handleAdminPromoMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await showPromoHub(ctx);
}

export async function handleAdminPromoCancel(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await showPromoHub(ctx);
}

export async function handleAdminPromoNew(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  if (!adminId) {
    return;
  }

  clearAdminContentSession(adminId);
  setAdminPromoSession(adminId, { step: "awaiting_code" });

  await presentPromoText(
    ctx,
    "➕ *إنشاء كود جديد*\n\n" +
      "أرسل *اسم الكود* الآن.\n" +
      "مثال: `WELCOME10`",
    {
      parse_mode: "Markdown",
      reply_markup: adminPromoCancelKeyboard(),
    }
  );
}

export async function handleAdminPromoList(
  ctx: Context,
  page = 0
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showPromoList(ctx, page);
}

export async function handleAdminPromoView(
  ctx: Context,
  promoId: number
): Promise<void> {
  const promo = getPromoById(promoId);
  if (!promo) {
    await ctx.answerCallbackQuery({
      text: "❌ الكود غير موجود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(`🎟️ *تفاصيل الكود*\n\n${formatPromoBlock(promo)}`, {
    parse_mode: "Markdown",
    reply_markup: adminPromoViewKeyboard({
      id: promo.id,
      isActive: promo.isActive,
    }),
  });
}

export async function handleAdminPromoSetActive(
  ctx: Context,
  promoId: number,
  isActive: boolean
): Promise<void> {
  const updated = setPromoActive(promoId, isActive);
  if (!updated) {
    await ctx.answerCallbackQuery({
      text: "❌ الكود غير موجود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({
    text: isActive ? "✅ تم تفعيل الكود." : "⏸️ تم تعطيل الكود.",
  });
  await ctx.editMessageText(`🎟️ *تفاصيل الكود*\n\n${formatPromoBlock(updated)}`, {
    parse_mode: "Markdown",
    reply_markup: adminPromoViewKeyboard({
      id: updated.id,
      isActive: updated.isActive,
    }),
  });
}

export async function handleAdminPromoDeleteAsk(
  ctx: Context,
  promoId: number
): Promise<void> {
  const promo = getPromoById(promoId);
  if (!promo) {
    await ctx.answerCallbackQuery({
      text: "❌ الكود غير موجود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `🗑️ *حذف الكود*\n\n` +
      `${formatPromoBlock(promo)}\n\n` +
      "هل تريد حذف هذا الكود؟\n" +
      "إذا كان مستخدماً في طلبات سابقة سيتم تعطيله بدل الحذف النهائي.",
    {
      parse_mode: "Markdown",
      reply_markup: adminPromoDeleteConfirmKeyboard(promo.id),
    }
  );
}

export async function handleAdminPromoDeleteConfirm(
  ctx: Context,
  promoId: number
): Promise<void> {
  const result = deleteOrDeactivatePromo(promoId);
  if (!result.ok) {
    await ctx.answerCallbackQuery({
      text: "❌ الكود غير موجود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({
    text:
      result.mode === "deleted"
        ? "🗑️ تم حذف الكود."
        : "⏸️ تم تعطيل الكود لأنه مرتبط بطلبات سابقة.",
  });

  if (result.mode === "deactivated" && result.promo) {
    await ctx.editMessageText(
      "⏸️ *تم تعطيل الكود بدل حذفه*\n\n" +
        `${formatPromoBlock(result.promo)}\n\n` +
        "هذا الكود مستخدم في طلبات سابقة، لذلك تم تعطيله للحفاظ على السجل.",
      {
        parse_mode: "Markdown",
        reply_markup: adminPromoViewKeyboard({
          id: result.promo.id,
          isActive: result.promo.isActive,
        }),
      }
    );
    return;
  }

  await showPromoList(ctx, 0);
}

export async function handleAdminPromoType(
  ctx: Context,
  discountType: PromoDiscountType
): Promise<void> {
  const adminId = ctx.from?.id;
  const session = adminId ? getAdminPromoSession(adminId) : undefined;
  if (!adminId || !session || session.step !== "awaiting_type" || !session.code) {
    await ctx.answerCallbackQuery({
      text: "❌ انتهت جلسة إنشاء الكود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  setAdminPromoSession(adminId, {
    ...session,
    discountType,
    step: "awaiting_value",
  });

  const valueHint =
    discountType === "percent"
      ? "أرسل *قيمة النسبة* من 1 إلى 100.\nمثال: `10`"
      : "أرسل *قيمة التخفيض* بالدينار الجزائري (أكبر من 0).\nمثال: `100`";

  await ctx.editMessageText(
    "➕ *إنشاء كود جديد*\n\n" +
      `🎟️ الكود: \`${session.code}\`\n` +
      `نوع التخفيض: ${discountTypeLabel(discountType)}\n\n` +
      valueHint,
    {
      parse_mode: "Markdown",
      reply_markup: adminPromoCancelKeyboard(),
    }
  );
}

export async function handleAdminPromoNoExpiry(ctx: Context): Promise<void> {
  const adminId = ctx.from?.id;
  const session = adminId ? getAdminPromoSession(adminId) : undefined;
  if (!adminId || !session || session.step !== "awaiting_expiry") {
    await ctx.answerCallbackQuery({
      text: "❌ انتهت جلسة إنشاء الكود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  await askMaxUses(ctx, adminId, { ...session, expiresAt: null });
}

export async function handleAdminPromoUnlimited(ctx: Context): Promise<void> {
  const adminId = ctx.from?.id;
  const session = adminId ? getAdminPromoSession(adminId) : undefined;
  if (
    !adminId ||
    !session ||
    session.step !== "awaiting_max_uses" ||
    !session.code ||
    !session.discountType ||
    session.discountValue == null
  ) {
    await ctx.answerCallbackQuery({
      text: "❌ انتهت جلسة إنشاء الكود.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();
  await finishCreatePromo(ctx, adminId, session, null);
}

async function askMaxUses(
  ctx: Context,
  adminId: number,
  session: AdminPromoSession
): Promise<void> {
  setAdminPromoSession(adminId, {
    ...session,
    step: "awaiting_max_uses",
  });

  await presentPromoText(
    ctx,
    "➕ *إنشاء كود جديد*\n\n" +
      `🎟️ الكود: \`${session.code}\`\n` +
      `نوع التخفيض: ${discountTypeLabel(session.discountType ?? "percent")}\n` +
      `القيمة: ${
        session.discountType === "percent"
          ? `${session.discountValue}%`
          : formatPriceDzd(session.discountValue)
      }\n` +
      `تاريخ الانتهاء: ${session.expiresAt ?? "بدون تاريخ انتهاء"}\n\n` +
      "أرسل *أقصى عدد استعمالات* (رقم موجب)، أو اختر غير محدود.",
    {
      parse_mode: "Markdown",
      reply_markup: adminPromoMaxUsesKeyboard(),
    }
  );
}

async function finishCreatePromo(
  ctx: Context,
  adminId: number,
  session: AdminPromoSession,
  maxUses: number | null
): Promise<void> {
  if (!session.code || !session.discountType || session.discountValue == null) {
    await presentPromoText(ctx, "❌ انتهت جلسة إنشاء الكود.", {
      reply_markup: adminPromoHubKeyboard(),
    });
    return;
  }

  try {
    const created = createPromoCode({
      code: session.code,
      discountType: session.discountType,
      discountValue: session.discountValue,
      expiresAt: session.expiresAt ?? null,
      maxUses,
    });
    clearAdminPromoSession(adminId);
    await presentPromoText(
      ctx,
      "✅ *تم إنشاء كود التخفيض*\n\n" + formatPromoBlock(created),
      {
        parse_mode: "Markdown",
        reply_markup: adminPromoViewKeyboard({
          id: created.id,
          isActive: created.isActive,
        }),
      }
    );
  } catch (error) {
    logger.error("Failed to create promo code", error);
    await presentPromoText(
      ctx,
      "❌ تعذّر إنشاء الكود. إذا كان الاسم مكرراً جرّب اسماً آخر.",
      {
        reply_markup: adminPromoCancelKeyboard(),
      }
    );
  }
}

export async function handleAdminPromoInput(ctx: Context): Promise<boolean> {
  const adminId = ctx.from?.id;
  const message = ctx.message;
  if (!adminId || !message) {
    return false;
  }

  const session = getAdminPromoSession(adminId);
  if (!session) {
    return false;
  }

  const text = message.text?.trim() ?? "";

  if (session.step === "awaiting_code") {
    const code = normalizePromoCodeInput(text);
    if (!code) {
      await ctx.reply(
        "❌ اسم الكود غير صالح.\n" +
          "استخدم حروفاً لاتينية وأرقاماً بدون مسافات.\n" +
          "مثال: `WELCOME10`",
        {
          parse_mode: "Markdown",
          reply_markup: adminPromoCancelKeyboard(),
        }
      );
      return true;
    }

    if (getPromoByCode(code)) {
      await ctx.reply("❌ هذا الكود موجود مسبقاً. أرسل اسماً مختلفاً.", {
        reply_markup: adminPromoCancelKeyboard(),
      });
      return true;
    }

    setAdminPromoSession(adminId, {
      step: "awaiting_type",
      code,
    });
    await ctx.reply(
      `✅ تم حفظ الكود: \`${code}\`\n\nاختر نوع التخفيض:`,
      {
        parse_mode: "Markdown",
        reply_markup: adminPromoTypeKeyboard(),
      }
    );
    return true;
  }

  if (session.step === "awaiting_type") {
    await ctx.reply("اختر نوع التخفيض من الأزرار أدناه.", {
      reply_markup: adminPromoTypeKeyboard(),
    });
    return true;
  }

  if (session.step === "awaiting_value") {
    const discountType = session.discountType;
    if (!discountType) {
      setAdminPromoSession(adminId, { ...session, step: "awaiting_type" });
      await ctx.reply("اختر نوع التخفيض من الأزرار أدناه.", {
        reply_markup: adminPromoTypeKeyboard(),
      });
      return true;
    }

    const value =
      discountType === "percent"
        ? parsePercentValue(text)
        : parsePositiveInt(text) ?? parsePriceDzd(text);
    if (value == null) {
      await ctx.reply(
        discountType === "percent"
          ? "❌ النسبة يجب أن تكون أكبر من 0 وأقل أو تساوي 100.\nمثال: `10`"
          : "❌ المبلغ الثابت يجب أن يكون أكبر من 0.\nمثال: `100`",
        {
          parse_mode: "Markdown",
          reply_markup: adminPromoCancelKeyboard(),
        }
      );
      return true;
    }

    setAdminPromoSession(adminId, {
      ...session,
      discountValue: value,
      step: "awaiting_expiry",
    });
    await ctx.reply(
      "✅ تم حفظ قيمة التخفيض.\n\n" +
        "أرسل *تاريخ الانتهاء* بصيغة `YYYY-MM-DD` أو `DD/MM/YYYY`،\n" +
        "أو اختر بدون تاريخ انتهاء.",
      {
        parse_mode: "Markdown",
        reply_markup: adminPromoExpiryKeyboard(),
      }
    );
    return true;
  }

  if (session.step === "awaiting_expiry") {
    const expiresAt = parsePromoExpiryDate(text);
    if (!expiresAt) {
      await ctx.reply(
        "❌ تاريخ الانتهاء غير صالح.\n" +
          "استخدم `YYYY-MM-DD` أو `DD/MM/YYYY`، أو اختر بدون تاريخ انتهاء.",
        {
          parse_mode: "Markdown",
          reply_markup: adminPromoExpiryKeyboard(),
        }
      );
      return true;
    }

    if (expiresAt < algiersTodayYmd()) {
      await ctx.reply(
        "❌ تاريخ الانتهاء لا يمكن أن يكون في الماضي.\n" +
          "أرسل تاريخاً صالحاً أو اختر بدون تاريخ انتهاء.",
        {
          reply_markup: adminPromoExpiryKeyboard(),
        }
      );
      return true;
    }

    await ctx.reply(
      `✅ تاريخ الانتهاء: ${expiresAt}\n\nأرسل أقصى عدد استعمالات أو اختر غير محدود.`,
      {
        reply_markup: adminPromoMaxUsesKeyboard(),
      }
    );
    setAdminPromoSession(adminId, {
      ...session,
      expiresAt,
      step: "awaiting_max_uses",
    });
    return true;
  }

  if (session.step === "awaiting_max_uses") {
    const maxUses = parsePositiveInt(text);
    if (maxUses == null) {
      await ctx.reply(
        "❌ عدد الاستعمالات يجب أن يكون رقماً موجباً، أو اختر غير محدود.",
        {
          reply_markup: adminPromoMaxUsesKeyboard(),
        }
      );
      return true;
    }

    await finishCreatePromo(ctx, adminId, session, maxUses);
    return true;
  }

  return true;
}
