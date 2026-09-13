import type { Context } from "grammy";
import {
  getCatalogItemById,
  getCatalogItemContext,
  getCatalogItemsByHierarchy,
} from "../database/catalogContent";
import { getActiveCatalogContentTypes } from "../database/catalogContentTypes";
import { getActiveSubjectsByYearId } from "../database/catalogSubjects";
import { getActiveSchoolYears } from "../database/catalogYears";
import type { ProductContentItem } from "../database/contentTypes";
import {
  catalogHierarchyItemDetailsKeyboard,
  catalogHierarchyItemsKeyboard,
  catalogHierarchySubjectsKeyboard,
  catalogHierarchyTypesKeyboard,
  catalogHierarchyYearsKeyboard,
} from "../keyboards/menus";
import { clearCheckoutSession } from "../state/checkoutSession";
import { formatPriceDzd } from "../utils/price";

const ACADEMY_URL_PENDING =
  "رابط هذا المحتوى على منصة 3M Academy سيضاف لاحقًا.";

function buildItemDetailsText(
  item: ProductContentItem,
  ctx: { yearName: string; subjectName: string; contentTypeName: string; contentTypeEmoji: string }
): string {
  return (
    `${ctx.contentTypeEmoji} *${item.titleAr}*\n\n` +
    `📅 السنة الدراسية: ${ctx.yearName}\n` +
    `📚 المادة: ${ctx.subjectName}\n` +
    `📌 نوع المحتوى: ${ctx.contentTypeName}\n` +
    `💰 السعر: ${formatPriceDzd(item.price)}\n\n` +
    (item.academyUrl?.trim()
      ? "اضغط الزر أدناه لعرض التفاصيل على منصة 3M Academy."
      : ACADEMY_URL_PENDING)
  );
}

export async function handleCatalogOrderMenu(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }

  const years = getActiveSchoolYears();

  const text =
    "🛒 *طلب المحتوى*\n\n" +
    "هذا البوت مساعد لمنصة 3M Academy.\n" +
    "اختر *السنة الدراسية* لاستعراض المحتوى المتاح.\n" +
    "لا يوجد شراء أو دفع داخل تيليجرام.";

  if (years.length === 0) {
    await ctx.editMessageText(
      text + "\n\n_لا توجد سنوات دراسية متاحة حالياً._",
      {
        parse_mode: "Markdown",
        reply_markup: catalogHierarchyYearsKeyboard([]),
      }
    );
    return;
  }

  await ctx.editMessageText(text + "\n\n_اختر السنة الدراسية:_", {
    parse_mode: "Markdown",
    reply_markup: catalogHierarchyYearsKeyboard(years),
  });
}

export async function handleCatalogYearSelect(
  ctx: Context,
  yearId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }

  const year = getActiveSchoolYears().find((y) => y.id === yearId);
  if (!year) {
    await ctx.editMessageText("❌ السنة الدراسية غير موجودة.", {
      reply_markup: catalogHierarchyYearsKeyboard(getActiveSchoolYears()),
    });
    return;
  }

  const subjects = getActiveSubjectsByYearId(yearId);

  await ctx.editMessageText(
    `📅 *${year.nameAr}*\n\n` +
      (subjects.length === 0
        ? "_لا توجد مواد في هذه السنة حالياً._"
        : "_اختر المادة:_"),
    {
      parse_mode: "Markdown",
      reply_markup: catalogHierarchySubjectsKeyboard(yearId, subjects),
    }
  );
}

export async function handleCatalogSubjectSelect(
  ctx: Context,
  yearId: number,
  subjectId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }

  const year = getActiveSchoolYears().find((y) => y.id === yearId);
  const subjects = getActiveSubjectsByYearId(yearId);
  const subject = subjects.find((s) => s.id === subjectId);

  if (!year || !subject) {
    await ctx.editMessageText("❌ المادة غير موجودة.", {
      reply_markup: catalogHierarchyYearsKeyboard(getActiveSchoolYears()),
    });
    return;
  }

  const types = getActiveCatalogContentTypes();

  await ctx.editMessageText(
    `📅 ${year.nameAr}\n` +
      `📚 *${subject.nameAr}*\n\n` +
      (types.length === 0
        ? "_لا توجد أنواع محتوى متاحة حالياً._"
        : "_اختر نوع المحتوى:_"),
    {
      parse_mode: "Markdown",
      reply_markup: catalogHierarchyTypesKeyboard(yearId, subjectId, types),
    }
  );
}

export async function handleCatalogTypeSelect(
  ctx: Context,
  yearId: number,
  subjectId: number,
  catalogContentTypeId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }

  const year = getActiveSchoolYears().find((y) => y.id === yearId);
  const subjects = getActiveSubjectsByYearId(yearId);
  const subject = subjects.find((s) => s.id === subjectId);
  const types = getActiveCatalogContentTypes();
  const contentType = types.find((t) => t.id === catalogContentTypeId);

  if (!year || !subject || !contentType) {
    await ctx.editMessageText("❌ نوع المحتوى غير موجود.", {
      reply_markup: catalogHierarchyYearsKeyboard(getActiveSchoolYears()),
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
      ? "_لا يوجد محتوى متاح في هذا القسم حالياً._"
      : items
          .map((item) => `• ${item.titleAr} — ${formatPriceDzd(item.price)}`)
          .join("\n");

  await ctx.editMessageText(
    `📅 ${year.nameAr}\n` +
      `📚 ${subject.nameAr}\n` +
      `${contentType.emoji} *${contentType.nameAr}*\n\n` +
      `${listText}\n\n` +
      (items.length > 0 ? "_اختر عنصراً لعرض التفاصيل:_" : ""),
    {
      parse_mode: "Markdown",
      reply_markup: catalogHierarchyItemsKeyboard(
        yearId,
        subjectId,
        catalogContentTypeId,
        items
      ),
    }
  );
}

export async function handleCatalogItemSelect(
  ctx: Context,
  itemId: number
): Promise<void> {
  await ctx.answerCallbackQuery();
  if (ctx.from) {
    clearCheckoutSession(ctx.from.id);
  }

  const item = getCatalogItemById(itemId);
  if (!item) {
    await ctx.editMessageText("❌ المحتوى غير موجود.", {
      reply_markup: catalogHierarchyYearsKeyboard(getActiveSchoolYears()),
    });
    return;
  }

  const itemContext = getCatalogItemContext(item);
  if (
    !itemContext ||
    item.yearId == null ||
    item.subjectId == null ||
    item.catalogContentTypeId == null
  ) {
    await ctx.editMessageText("❌ المحتوى غير موجود.", {
      reply_markup: catalogHierarchyYearsKeyboard(getActiveSchoolYears()),
    });
    return;
  }

  await ctx.editMessageText(buildItemDetailsText(item, itemContext), {
    parse_mode: "Markdown",
    reply_markup: catalogHierarchyItemDetailsKeyboard(
      item.id,
      item.yearId,
      item.subjectId,
      item.catalogContentTypeId,
      item.academyUrl
    ),
  });
}

export async function handleCatalogAcademyOpen(
  ctx: Context,
  itemId: number
): Promise<void> {
  const item = getCatalogItemById(itemId);
  const url = item?.academyUrl?.trim();

  if (url) {
    await ctx.answerCallbackQuery({ url });
    return;
  }

  await ctx.answerCallbackQuery({
    text: ACADEMY_URL_PENDING,
    show_alert: true,
  });
}
