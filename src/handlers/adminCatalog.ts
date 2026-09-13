import type { Context } from "grammy";
import {
  createCatalogItem,
  deleteCatalogItem,
  getCatalogItemByIdAny,
  getCatalogItemsByHierarchy,
  updateCatalogItemAcademyUrl,
  updateCatalogItemPrice,
  updateCatalogItemTitle,
} from "../database/catalogContent";
import {
  createCatalogContentType,
  getActiveCatalogContentTypes,
  getAllCatalogContentTypes,
  getCatalogContentTypeById,
  setCatalogContentTypeActive,
  updateCatalogContentTypeName,
} from "../database/catalogContentTypes";
import {
  createCatalogSubject,
  getActiveSubjectsByYearId,
  getAllSubjectsByYearId,
  getCatalogSubjectById,
  setCatalogSubjectActive,
  updateCatalogSubjectName,
} from "../database/catalogSubjects";
import {
  createSchoolYear,
  getActiveSchoolYears,
  getAllSchoolYears,
  getSchoolYearById,
  setSchoolYearActive,
  updateSchoolYearName,
} from "../database/catalogYears";
import {
  adminBackKeyboard,
  adminCatalogBrowseSubjectsKeyboard,
  adminCatalogBrowseTypesKeyboard,
  adminCatalogBrowseYearsKeyboard,
  adminCatalogCancelKeyboard,
  adminCatalogHubKeyboard,
  adminCatalogItemDeleteConfirmKeyboard,
  adminCatalogItemKeyboard,
  adminCatalogItemsKeyboard,
  adminCatalogSubjectKeyboard,
  adminCatalogTypeKeyboard,
  adminCatalogTypesKeyboard,
  adminCatalogYearKeyboard,
  adminCatalogYearsKeyboard,
} from "../keyboards/menus";
import {
  clearAdminCatalogSession,
  getAdminCatalogSession,
  setAdminCatalogSession,
} from "../state/adminCatalogSession";
import { clearAdminContentSession } from "../state/adminContentSession";
import { clearAdminPromoSession } from "../state/adminPromoSession";
import { clearAdminSettingsSession } from "../state/adminSettingsSession";
import { formatPriceDzd, INVALID_PRICE_MESSAGE, parsePriceDzd } from "../utils/price";

function resetOtherAdminSessions(adminId: number): void {
  clearAdminPromoSession(adminId);
  clearAdminSettingsSession(adminId);
  clearAdminContentSession(adminId);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildAdminCatalogItemMessage(
  item: NonNullable<ReturnType<typeof getCatalogItemByIdAny>>
): string {
  const year = item.yearId != null ? getSchoolYearById(item.yearId) : null;
  const subject =
    item.subjectId != null ? getCatalogSubjectById(item.subjectId) : null;
  const contentType =
    item.catalogContentTypeId != null
      ? getCatalogContentTypeById(item.catalogContentTypeId)
      : null;

  return (
    `📄 *${item.titleAr}*\n\n` +
    `📅 السنة: ${year?.nameAr ?? "—"}\n` +
    `📚 المادة: ${subject?.nameAr ?? "—"}\n` +
    `📌 النوع: ${contentType ? `${contentType.emoji} ${contentType.nameAr}` : "—"}\n` +
    `💰 السعر: ${formatPriceDzd(item.price)}\n` +
    `🌐 رابط Academy: ${item.academyUrl?.trim() ? item.academyUrl : "—"}\n\n` +
    "_اختر إجراءً:_"
  );
}

export async function handleAdminCatalogMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  await ctx.editMessageText(
    "📚 *إدارة المحتوى*\n\n" +
      "أدر السنوات الدراسية والمواد وأنواع المحتوى والعناصر.\n" +
      "كل شيء ديناميكي من قاعدة البيانات.",
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogHubKeyboard(),
    }
  );
}

export async function handleAdminCatalogYears(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const years = getAllSchoolYears();
  await ctx.editMessageText(
    "📅 *السنوات الدراسية*\n\n" +
      (years.length === 0
        ? "_لا توجد سنوات بعد. أضف سنة جديدة._"
        : "_اختر سنة لإدارة موادها:_"),
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogYearsKeyboard(years),
    }
  );
}

export async function handleAdminCatalogYearView(
  ctx: Context,
  yearId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const year = getSchoolYearById(yearId);
  if (!year) {
    await ctx.editMessageText("❌ السنة غير موجودة.", {
      reply_markup: adminCatalogYearsKeyboard(getAllSchoolYears()),
    });
    return;
  }

  const subjects = getAllSubjectsByYearId(yearId);
  await ctx.editMessageText(
    `📅 *${year.nameAr}*\n` +
      `الحالة: ${year.isActive ? "✅ مفعّلة" : "⏸️ معطّلة"}\n\n` +
      (subjects.length === 0
        ? "_لا توجد مواد في هذه السنة._"
        : "_المواد:_"),
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogYearKeyboard(year, subjects),
    }
  );
}

export async function handleAdminCatalogYearAdd(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  if (!adminId) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, { step: "awaiting_year_name" });

  await ctx.editMessageText(
    "➕ *إضافة سنة دراسية*\n\n✏️ أرسل اسم السنة الدراسية كنص.",
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard("years"),
    }
  );
}

export async function handleAdminCatalogYearRename(
  ctx: Context,
  yearId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const year = getSchoolYearById(yearId);
  if (!adminId || !year) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_year_rename",
    yearId,
  });

  await ctx.editMessageText(
    `✏️ *تغيير اسم السنة*\n\nالاسم الحالي: *${year.nameAr}*\n\nأرسل الاسم الجديد.`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(`year:${yearId}`),
    }
  );
}

export async function handleAdminCatalogYearToggle(
  ctx: Context,
  yearId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const year = getSchoolYearById(yearId);
  if (!year) return;

  setSchoolYearActive(yearId, !year.isActive);
  await handleAdminCatalogYearView(ctx, yearId);
}

export async function handleAdminCatalogSubjectView(
  ctx: Context,
  yearId: number,
  subjectId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const subject = getCatalogSubjectById(subjectId);
  const year = getSchoolYearById(yearId);
  if (!subject || !year || subject.yearId !== yearId) {
    await ctx.editMessageText("❌ المادة غير موجودة.", {
      reply_markup: adminCatalogYearsKeyboard(getAllSchoolYears()),
    });
    return;
  }

  await ctx.editMessageText(
    `📅 ${year.nameAr}\n` +
      `📚 *${subject.nameAr}*\n` +
      `الحالة: ${subject.isActive ? "✅ مفعّلة" : "⏸️ معطّلة"}`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogSubjectKeyboard(yearId, subject),
    }
  );
}

export async function handleAdminCatalogSubjectAdd(
  ctx: Context,
  yearId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const year = getSchoolYearById(yearId);
  if (!adminId || !year) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_subject_name",
    yearId,
  });

  await ctx.editMessageText(
    `➕ *إضافة مادة*\n\n📅 ${year.nameAr}\n\n✏️ أرسل اسم المادة كنص.`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(`year:${yearId}`),
    }
  );
}

export async function handleAdminCatalogSubjectRename(
  ctx: Context,
  yearId: number,
  subjectId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const subject = getCatalogSubjectById(subjectId);
  if (!adminId || !subject) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_subject_rename",
    yearId,
    subjectId,
  });

  await ctx.editMessageText(
    `✏️ *تغيير اسم المادة*\n\nالاسم الحالي: *${subject.nameAr}*\n\nأرسل الاسم الجديد.`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(`subject:${yearId}:${subjectId}`),
    }
  );
}

export async function handleAdminCatalogSubjectToggle(
  ctx: Context,
  yearId: number,
  subjectId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const subject = getCatalogSubjectById(subjectId);
  if (!subject) return;

  setCatalogSubjectActive(subjectId, !subject.isActive);
  await handleAdminCatalogSubjectView(ctx, yearId, subjectId);
}

export async function handleAdminCatalogTypes(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const types = getAllCatalogContentTypes();
  await ctx.editMessageText(
    "📋 *أنواع المحتوى*\n\n" +
      (types.length === 0
        ? "_لا توجد أنواع بعد._"
        : "_اختر نوعاً لإدارته:_"),
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogTypesKeyboard(types),
    }
  );
}

export async function handleAdminCatalogTypeView(
  ctx: Context,
  typeId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const contentType = getCatalogContentTypeById(typeId);
  if (!contentType) {
    await ctx.editMessageText("❌ النوع غير موجود.", {
      reply_markup: adminCatalogTypesKeyboard(getAllCatalogContentTypes()),
    });
    return;
  }

  await ctx.editMessageText(
    `${contentType.emoji} *${contentType.nameAr}*\n` +
      `Slug: \`${contentType.slug}\`\n` +
      `الحالة: ${contentType.isActive ? "✅ مفعّل" : "⏸️ معطّل"}`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogTypeKeyboard(contentType),
    }
  );
}

export async function handleAdminCatalogTypeAdd(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  if (!adminId) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, { step: "awaiting_type_name" });

  await ctx.editMessageText(
    "➕ *إضافة نوع محتوى*\n\n✏️ أرسل اسم النوع بالعربية.",
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard("types"),
    }
  );
}

export async function handleAdminCatalogTypeRename(
  ctx: Context,
  typeId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const contentType = getCatalogContentTypeById(typeId);
  if (!adminId || !contentType) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_type_rename",
    catalogContentTypeId: typeId,
    typeEmoji: contentType.emoji,
  });

  await ctx.editMessageText(
    `✏️ *تغيير اسم النوع*\n\nالاسم الحالي: *${contentType.nameAr}*\n\nأرسل الاسم الجديد (يمكنك إضافة emoji في البداية).`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(`type:${typeId}`),
    }
  );
}

export async function handleAdminCatalogTypeToggle(
  ctx: Context,
  typeId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const contentType = getCatalogContentTypeById(typeId);
  if (!contentType) return;

  setCatalogContentTypeActive(typeId, !contentType.isActive);
  await handleAdminCatalogTypeView(ctx, typeId);
}

export async function handleAdminCatalogBrowseYears(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const years = getActiveSchoolYears();
  await ctx.editMessageText(
    "📂 *إدارة عناصر المحتوى*\n\n_اختر السنة الدراسية:_",
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogBrowseYearsKeyboard(years),
    }
  );
}

export async function handleAdminCatalogBrowseSubjects(
  ctx: Context,
  yearId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const year = getSchoolYearById(yearId);
  if (!year) {
    await ctx.editMessageText("❌ السنة غير موجودة.", {
      reply_markup: adminCatalogBrowseYearsKeyboard(getActiveSchoolYears()),
    });
    return;
  }

  const subjects = getActiveSubjectsByYearId(yearId);
  await ctx.editMessageText(
    `📅 *${year.nameAr}*\n\n_اختر المادة:_`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogBrowseSubjectsKeyboard(yearId, subjects),
    }
  );
}

export async function handleAdminCatalogBrowseTypes(
  ctx: Context,
  yearId: number,
  subjectId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const year = getSchoolYearById(yearId);
  const subject = getCatalogSubjectById(subjectId);
  if (!year || !subject) {
    await ctx.editMessageText("❌ المادة غير موجودة.", {
      reply_markup: adminCatalogBrowseYearsKeyboard(getActiveSchoolYears()),
    });
    return;
  }

  const types = getActiveCatalogContentTypes();
  await ctx.editMessageText(
    `📅 ${year.nameAr}\n📚 *${subject.nameAr}*\n\n_اختر نوع المحتوى:_`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogBrowseTypesKeyboard(yearId, subjectId, types),
    }
  );
}

export async function handleAdminCatalogItemsList(
  ctx: Context,
  yearId: number,
  subjectId: number,
  catalogContentTypeId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const year = getSchoolYearById(yearId);
  const subject = getCatalogSubjectById(subjectId);
  const contentType = getCatalogContentTypeById(catalogContentTypeId);
  if (!year || !subject || !contentType) {
    await ctx.editMessageText("❌ القسم غير موجود.", {
      reply_markup: adminCatalogBrowseYearsKeyboard(getActiveSchoolYears()),
    });
    return;
  }

  const items = getCatalogItemsByHierarchy(
    yearId,
    subjectId,
    catalogContentTypeId
  );

  const listText =
    items.length === 0
      ? "_لا يوجد محتوى في هذا القسم._"
      : items
          .map((item) => `• ${item.titleAr} — ${formatPriceDzd(item.price)}`)
          .join("\n");

  await ctx.editMessageText(
    `📅 ${year.nameAr}\n` +
      `📚 ${subject.nameAr}\n` +
      `${contentType.emoji} *${contentType.nameAr}*\n\n` +
      listText,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogItemsKeyboard(
        yearId,
        subjectId,
        catalogContentTypeId,
        items
      ),
    }
  );
}

export async function handleAdminCatalogItemView(
  ctx: Context,
  itemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  const item = getCatalogItemByIdAny(itemId);
  if (!item?.isCatalogItem) {
    await ctx.editMessageText("❌ العنصر غير موجود.", {
      reply_markup: adminCatalogHubKeyboard(),
    });
    return;
  }

  await ctx.editMessageText(buildAdminCatalogItemMessage(item), {
    parse_mode: "Markdown",
    reply_markup: adminCatalogItemKeyboard(item),
  });
}

export async function handleAdminCatalogItemAdd(
  ctx: Context,
  yearId: number,
  subjectId: number,
  catalogContentTypeId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  if (!adminId) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_item_title",
    yearId,
    subjectId,
    catalogContentTypeId,
  });

  await ctx.editMessageText(
    "➕ *إضافة محتوى*\n\n✏️ أرسل *اسم* المحتوى كنص.",
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(
        `items:${yearId}:${subjectId}:${catalogContentTypeId}`
      ),
    }
  );
}

export async function handleAdminCatalogItemRename(
  ctx: Context,
  itemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const item = getCatalogItemByIdAny(itemId);
  if (!adminId || !item?.isCatalogItem) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_item_rename",
    itemId,
  });

  await ctx.editMessageText(
    `✏️ *تغيير الاسم*\n\nالاسم الحالي: *${item.titleAr}*\n\nأرسل الاسم الجديد.`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(`item:${itemId}`),
    }
  );
}

export async function handleAdminCatalogItemPrice(
  ctx: Context,
  itemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const item = getCatalogItemByIdAny(itemId);
  if (!adminId || !item?.isCatalogItem) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_item_price_edit",
    itemId,
  });

  await ctx.editMessageText(
    `💰 *تغيير السعر*\n\n${item.titleAr}\nالسعر الحالي: *${formatPriceDzd(item.price)}*\n\nأرسل السعر بالدينار.`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(`item:${itemId}`),
    }
  );
}

export async function handleAdminCatalogItemUrl(
  ctx: Context,
  itemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const adminId = ctx.from?.id;
  const item = getCatalogItemByIdAny(itemId);
  if (!adminId || !item?.isCatalogItem) return;

  resetOtherAdminSessions(adminId);
  setAdminCatalogSession(adminId, {
    step: "awaiting_item_url_edit",
    itemId,
  });

  await ctx.editMessageText(
    `🌐 *رابط 3M Academy*\n\n` +
      `الرابط الحالي: ${item.academyUrl?.trim() ? item.academyUrl : "—"}\n\n` +
      "أرسل الرابط (http/https) أو `-` لحذف الرابط.",
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(`item:${itemId}`),
    }
  );
}

export async function handleAdminCatalogItemDeleteAsk(
  ctx: Context,
  itemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const item = getCatalogItemByIdAny(itemId);
  if (!item?.isCatalogItem) {
    await ctx.editMessageText("❌ العنصر غير موجود.", {
      reply_markup: adminCatalogHubKeyboard(),
    });
    return;
  }

  await ctx.editMessageText(
    `⚠️ *تأكيد الحذف*\n\n📄 ${item.titleAr}\n\nهل تريد حذف هذا العنصر؟`,
    {
      parse_mode: "Markdown",
      reply_markup: adminCatalogItemDeleteConfirmKeyboard(itemId),
    }
  );
}

export async function handleAdminCatalogItemDeleteConfirm(
  ctx: Context,
  itemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  const item = getCatalogItemByIdAny(itemId);
  if (!item?.isCatalogItem) {
    await ctx.editMessageText("❌ العنصر غير موجود.", {
      reply_markup: adminCatalogHubKeyboard(),
    });
    return;
  }

  const yearId = item.yearId!;
  const subjectId = item.subjectId!;
  const typeId = item.catalogContentTypeId!;
  deleteCatalogItem(itemId);

  await ctx.editMessageText("✅ *تم حذف العنصر.*", {
    parse_mode: "Markdown",
    reply_markup: adminCatalogItemsKeyboard(
      yearId,
      subjectId,
      typeId,
      getCatalogItemsByHierarchy(yearId, subjectId, typeId)
    ),
  });
}

export async function handleAdminCatalogCancel(
  ctx: Context,
  target: string
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from?.id) {
    clearAdminCatalogSession(ctx.from.id);
  }

  if (target === "hub") {
    await handleAdminCatalogMenu(ctx);
    return;
  }
  if (target === "years") {
    await handleAdminCatalogYears(ctx);
    return;
  }
  if (target === "types") {
    await handleAdminCatalogTypes(ctx);
    return;
  }
  if (target === "browse") {
    await handleAdminCatalogBrowseYears(ctx);
    return;
  }
  if (target.startsWith("year:")) {
    await handleAdminCatalogYearView(ctx, Number(target.slice(5)));
    return;
  }
  if (target.startsWith("subject:")) {
    const [, yearId, subjectId] = target.split(":");
    await handleAdminCatalogSubjectView(ctx, Number(yearId), Number(subjectId));
    return;
  }
  if (target.startsWith("type:")) {
    await handleAdminCatalogTypeView(ctx, Number(target.slice(5)));
    return;
  }
  if (target.startsWith("items:")) {
    const [, yearId, subjectId, typeId] = target.split(":");
    await handleAdminCatalogItemsList(
      ctx,
      Number(yearId),
      Number(subjectId),
      Number(typeId)
    );
    return;
  }
  if (target.startsWith("item:")) {
    await handleAdminCatalogItemView(ctx, Number(target.slice(5)));
  }
}

function parseEmojiPrefix(text: string): { emoji: string; nameAr: string } {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\p{Extended_Pictographic})\s+(.+)$/u);
  if (match) {
    return { emoji: match[1], nameAr: match[2].trim() };
  }
  return { emoji: "📄", nameAr: trimmed };
}

export async function handleAdminCatalogInput(ctx: Context): Promise<boolean> {
  const adminId = ctx.from?.id;
  const message = ctx.message;
  if (!adminId || !message?.text) {
    return false;
  }

  const session = getAdminCatalogSession(adminId);
  if (!session) {
    return false;
  }

  const text = message.text.trim();

  if (session.step === "awaiting_year_name") {
    if (!text) {
      await ctx.reply("❌ أرسل اسم السنة كنص.");
      return true;
    }
    const year = createSchoolYear({ nameAr: text });
    clearAdminCatalogSession(adminId);
    await ctx.reply(`✅ تمت إضافة السنة: *${year.nameAr}*`, {
      parse_mode: "Markdown",
      reply_markup: adminCatalogYearKeyboard(year, []),
    });
    return true;
  }

  if (session.step === "awaiting_year_rename" && session.yearId != null) {
    if (!text) {
      await ctx.reply("❌ أرسل الاسم الجديد.");
      return true;
    }
    updateSchoolYearName(session.yearId, text);
    clearAdminCatalogSession(adminId);
    const year = getSchoolYearById(session.yearId)!;
    await ctx.reply(`✅ تم تحديث الاسم إلى: *${year.nameAr}*`, {
      parse_mode: "Markdown",
      reply_markup: adminCatalogYearKeyboard(
        year,
        getAllSubjectsByYearId(session.yearId)
      ),
    });
    return true;
  }

  if (session.step === "awaiting_subject_name" && session.yearId != null) {
    if (!text) {
      await ctx.reply("❌ أرسل اسم المادة.");
      return true;
    }
    const subject = createCatalogSubject({
      yearId: session.yearId,
      nameAr: text,
    });
    clearAdminCatalogSession(adminId);
    await ctx.reply(`✅ تمت إضافة المادة: *${subject.nameAr}*`, {
      parse_mode: "Markdown",
      reply_markup: adminCatalogSubjectKeyboard(session.yearId, subject),
    });
    return true;
  }

  if (
    session.step === "awaiting_subject_rename" &&
    session.yearId != null &&
    session.subjectId != null
  ) {
    if (!text) {
      await ctx.reply("❌ أرسل الاسم الجديد.");
      return true;
    }
    updateCatalogSubjectName(session.subjectId, text);
    clearAdminCatalogSession(adminId);
    const subject = getCatalogSubjectById(session.subjectId)!;
    await ctx.reply(`✅ تم تحديث الاسم إلى: *${subject.nameAr}*`, {
      parse_mode: "Markdown",
      reply_markup: adminCatalogSubjectKeyboard(session.yearId, subject),
    });
    return true;
  }

  if (session.step === "awaiting_type_name") {
    if (!text) {
      await ctx.reply("❌ أرسل اسم النوع.");
      return true;
    }
    const parsed = parseEmojiPrefix(text);
    setAdminCatalogSession(adminId, {
      ...session,
      step: "awaiting_type_emoji",
      typeNameAr: parsed.nameAr,
      typeEmoji: parsed.emoji,
    });
    await ctx.reply(
      `✅ الاسم: *${parsed.nameAr}*\n\nأرسل emoji للنوع أو اكتب \`-\` للإبقاء على ${parsed.emoji}`,
      { parse_mode: "Markdown", reply_markup: adminCatalogCancelKeyboard("types") }
    );
    return true;
  }

  if (session.step === "awaiting_type_emoji" && session.typeNameAr) {
    const emoji =
      text === "-" ? (session.typeEmoji ?? "📄") : text.trim() || "📄";
    const slug = `type-${Date.now()}`;
    const contentType = createCatalogContentType({
      slug,
      nameAr: session.typeNameAr,
      emoji,
    });
    clearAdminCatalogSession(adminId);
    await ctx.reply(`✅ تمت إضافة النوع: ${contentType.emoji} *${contentType.nameAr}*`, {
      parse_mode: "Markdown",
      reply_markup: adminCatalogTypeKeyboard(contentType),
    });
    return true;
  }

  if (session.step === "awaiting_type_rename" && session.catalogContentTypeId != null) {
    if (!text) {
      await ctx.reply("❌ أرسل الاسم الجديد.");
      return true;
    }
    const parsed = parseEmojiPrefix(text);
    updateCatalogContentTypeName(
      session.catalogContentTypeId,
      parsed.nameAr,
      parsed.emoji
    );
    clearAdminCatalogSession(adminId);
    const contentType = getCatalogContentTypeById(session.catalogContentTypeId)!;
    await ctx.reply(`✅ تم التحديث: ${contentType.emoji} *${contentType.nameAr}*`, {
      parse_mode: "Markdown",
      reply_markup: adminCatalogTypeKeyboard(contentType),
    });
    return true;
  }

  if (
    session.step === "awaiting_item_title" &&
    session.yearId != null &&
    session.subjectId != null &&
    session.catalogContentTypeId != null
  ) {
    if (!text) {
      await ctx.reply("❌ أرسل اسم المحتوى.");
      return true;
    }
    setAdminCatalogSession(adminId, {
      ...session,
      step: "awaiting_item_price",
      titleAr: text,
    });
    await ctx.reply("💰 أرسل *السعر* بالدينار الجزائري.", {
      parse_mode: "Markdown",
      reply_markup: adminCatalogCancelKeyboard(
        `items:${session.yearId}:${session.subjectId}:${session.catalogContentTypeId}`
      ),
    });
    return true;
  }

  if (
    session.step === "awaiting_item_price" &&
    session.yearId != null &&
    session.subjectId != null &&
    session.catalogContentTypeId != null &&
    session.titleAr
  ) {
    const price = parsePriceDzd(text);
    if (price == null) {
      await ctx.reply(INVALID_PRICE_MESSAGE, { parse_mode: "Markdown" });
      return true;
    }
    setAdminCatalogSession(adminId, {
      ...session,
      step: "awaiting_item_url",
      price,
    });
    await ctx.reply(
      "🌐 أرسل *رابط 3M Academy* (http/https) أو `-` لتخطي الرابط.",
      {
        parse_mode: "Markdown",
        reply_markup: adminCatalogCancelKeyboard(
          `items:${session.yearId}:${session.subjectId}:${session.catalogContentTypeId}`
        ),
      }
    );
    return true;
  }

  if (
    session.step === "awaiting_item_url" &&
    session.yearId != null &&
    session.subjectId != null &&
    session.catalogContentTypeId != null &&
    session.titleAr &&
    session.price != null
  ) {
    let academyUrl: string | null = null;
    if (text !== "-") {
      if (!isValidUrl(text)) {
        await ctx.reply("❌ الرابط غير صالح. استخدم http أو https أو `-` للتخطي.");
        return true;
      }
      academyUrl = text;
    }

    const item = createCatalogItem({
      yearId: session.yearId,
      subjectId: session.subjectId,
      catalogContentTypeId: session.catalogContentTypeId,
      titleAr: session.titleAr,
      price: session.price,
      academyUrl,
    });
    clearAdminCatalogSession(adminId);

    await ctx.reply("✅ *تمت إضافة المحتوى.*\n\n" + buildAdminCatalogItemMessage(item), {
      parse_mode: "Markdown",
      reply_markup: adminCatalogItemKeyboard(item),
    });
    return true;
  }

  if (session.step === "awaiting_item_rename" && session.itemId != null) {
    if (!text) {
      await ctx.reply("❌ أرسل الاسم الجديد.");
      return true;
    }
    const updated = updateCatalogItemTitle(session.itemId, text);
    clearAdminCatalogSession(adminId);
    if (!updated) {
      await ctx.reply("❌ تعذّر التحديث.");
      return true;
    }
    await ctx.reply("✅ *تم تحديث الاسم.*\n\n" + buildAdminCatalogItemMessage(updated), {
      parse_mode: "Markdown",
      reply_markup: adminCatalogItemKeyboard(updated),
    });
    return true;
  }

  if (session.step === "awaiting_item_price_edit" && session.itemId != null) {
    const price = parsePriceDzd(text);
    if (price == null) {
      await ctx.reply(INVALID_PRICE_MESSAGE, { parse_mode: "Markdown" });
      return true;
    }
    const updated = updateCatalogItemPrice(session.itemId, price);
    clearAdminCatalogSession(adminId);
    if (!updated) {
      await ctx.reply("❌ تعذّر التحديث.");
      return true;
    }
    await ctx.reply("✅ *تم تحديث السعر.*\n\n" + buildAdminCatalogItemMessage(updated), {
      parse_mode: "Markdown",
      reply_markup: adminCatalogItemKeyboard(updated),
    });
    return true;
  }

  if (session.step === "awaiting_item_url_edit" && session.itemId != null) {
    let academyUrl: string | null = null;
    if (text !== "-") {
      if (!isValidUrl(text)) {
        await ctx.reply("❌ الرابط غير صالح. استخدم http/https أو `-` للحذف.");
        return true;
      }
      academyUrl = text;
    }
    const updated = updateCatalogItemAcademyUrl(session.itemId, academyUrl);
    clearAdminCatalogSession(adminId);
    if (!updated) {
      await ctx.reply("❌ تعذّر التحديث.");
      return true;
    }
    await ctx.reply("✅ *تم تحديث الرابط.*\n\n" + buildAdminCatalogItemMessage(updated), {
      parse_mode: "Markdown",
      reply_markup: adminCatalogItemKeyboard(updated),
    });
    return true;
  }

  return false;
}
