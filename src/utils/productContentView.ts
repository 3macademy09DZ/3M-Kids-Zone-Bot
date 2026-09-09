import { getContentItemsByProductAndType } from "../database/content";
import {
  CONTENT_TYPE_ADD_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  type ContentType,
  type ProductContentItem,
} from "../database/contentTypes";
import { InlineKeyboard } from "grammy";
import { CB } from "../keyboards/menus";

export function groupContentByType(
  productId: string
): Record<ContentType, ProductContentItem[]> {
  return {
    video: getContentItemsByProductAndType(productId, "video"),
    game: getContentItemsByProductAndType(productId, "game"),
    file: getContentItemsByProductAndType(productId, "file"),
  };
}

export function buildProductSectionsMessage(
  productName: string,
  productDescription: string,
  productId: string
): string {
  const grouped = groupContentByType(productId);

  const lines = [
    `📂 *${productName}*`,
    "",
    productDescription,
    "",
    "*الأقسام المتاحة:*",
  ];

  for (const type of CONTENT_TYPES) {
    const count = grouped[type].length;
    lines.push(`${CONTENT_TYPE_LABELS[type]} — ${count} عنصر/عناصر`);
  }

  lines.push("", "_اختر قسماً لعرض محتواه:_");
  return lines.join("\n");
}

export function buildSectionContentMessage(
  productName: string,
  contentType: ContentType,
  productId: string
): string {
  const items = getContentItemsByProductAndType(productId, contentType);
  const lines = [
    `📂 *${productName}*`,
    "",
    CONTENT_TYPE_LABELS[contentType],
    "",
  ];

  if (items.length === 0) {
    lines.push("_لا يوجد محتوى في هذا القسم حالياً._");
  } else {
    lines.push("*المحتوى المتاح:*");
    for (const item of items) {
      lines.push(`• ${item.titleAr}`);
    }
    lines.push("", "_اضغط على عنصر لفتحه:_");
  }

  return lines.join("\n");
}

export function buildAdminProductSectionsMessage(
  productName: string,
  productId: string
): string {
  const grouped = groupContentByType(productId);

  const lines = [
    `📚 *${productName}*`,
    "",
    "*أقسام المحتوى:*",
  ];

  for (const type of CONTENT_TYPES) {
    const count = grouped[type].length;
    lines.push(`${CONTENT_TYPE_LABELS[type]} — ${count} عنصر/عناصر`);
  }

  lines.push("", "_اختر قسماً لإدارته:_");
  return lines.join("\n");
}

export function buildAdminSectionMessage(
  productName: string,
  contentType: ContentType,
  productId: string
): string {
  const items = getContentItemsByProductAndType(productId, contentType);
  const lines = [
    `📚 *${productName}*`,
    "",
    CONTENT_TYPE_LABELS[contentType],
    "",
  ];

  if (items.length === 0) {
    lines.push("_لا يوجد محتوى في هذا القسم._");
    lines.push("", "_يمكنك إضافة محتوى جديد الآن._");
  } else {
    lines.push("*المحتوى الحالي:*");
    for (const item of items) {
      lines.push(`• ${item.titleAr}`);
    }
  }

  return lines.join("\n");
}

export function customerProductSectionsKeyboard(productId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const type of CONTENT_TYPES) {
    keyboard
      .text(CONTENT_TYPE_LABELS[type], `${CB.MY_CONTENT_SECTION}${productId}:${type}`)
      .row();
  }

  keyboard.text("↩️ منتجاتي", CB.MY_PRODUCTS_BACK);
  return keyboard;
}

export function customerSectionItemsKeyboard(
  productId: string,
  contentType: ContentType
): InlineKeyboard {
  const items = getContentItemsByProductAndType(productId, contentType);
  const keyboard = new InlineKeyboard();

  for (const item of items) {
    const prefix =
      contentType === "video" ? "🎬" : contentType === "game" ? "🎮" : "📁";
    keyboard
      .text(`${prefix} ${item.titleAr}`, `${CB.MY_CONTENT_ITEM}${item.id}`)
      .row();
  }

  keyboard
    .text("↩️ رجوع", `${CB.MY_PRODUCT}${productId}`)
    .row();
  return keyboard;
}

export function adminProductSectionsKeyboard(productId: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const type of CONTENT_TYPES) {
    keyboard
      .text(CONTENT_TYPE_LABELS[type], `${CB.ADMIN_CONTENT_SECTION}${productId}:${type}`)
      .row();
  }

  keyboard.text("↩️ المنتجات", CB.ADMIN_CONTENT).row();
  keyboard.text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
  return keyboard;
}

export function adminSectionKeyboard(
  productId: string,
  contentType: ContentType
): InlineKeyboard {
  return new InlineKeyboard()
    .text(CONTENT_TYPE_ADD_LABELS[contentType], `${CB.ADMIN_CONTENT_ADD}${productId}:${contentType}`)
    .row()
    .text("↩️ رجوع", `${CB.ADMIN_CONTENT_PRODUCT}${productId}`)
    .row()
    .text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
}
