import { InlineKeyboard } from "grammy";
import type { Order } from "../database/types";
import { isPendingOrderStatus } from "../database/types";
import { getProductById } from "../data/products";

export const CB = {
  ABOUT: "about",
  ORDER: "order",
  CONTACT: "contact",
  BACK_MAIN: "back_main",
  ORDER_PRODUCT: "order_product:",
  ORDER_CONTENT: "order_content:",
  CONFIRM_ORDER: "confirm_order:",
  MY_PRODUCTS: "my_products",
  MY_PRODUCT: "my_product:",
  ADMIN_ORDERS: "admin_orders",
  ADMIN_APPROVE_ORDER: "admin_approve_order:",
  ADMIN_CUSTOMERS: "admin_customers",
  ADMIN_INVITES: "admin_invites",
  ADMIN_SETTINGS: "admin_settings",
  ADMIN_BACK: "admin_back",
  ADMIN_CONTENT: "admin_content",
  ADMIN_CONTENT_PRODUCT: "admin_content_product:",
  ADMIN_CONTENT_SECTION: "admin_content_section:",
  ADMIN_CONTENT_ADD: "admin_content_add:",
  MY_PRODUCTS_BACK: "my_products_back",
  MY_CONTENT_SECTION: "my_content_section:",
  MY_CONTENT_ITEM: "my_content_item:",
} as const;

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎓 التعرف على المحتوى", CB.ABOUT)
    .row()
    .text("🛒 طلب المحتوى", CB.ORDER)
    .row()
    .text("📦 منتجاتي", CB.MY_PRODUCTS)
    .row()
    .text("📞 التواصل معنا", CB.CONTACT);
}

export function openMyProductsKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("📦 فتح منتجاتي", CB.MY_PRODUCTS);
}

export function backToMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
}

export function productListKeyboard(
  products: { id: string; nameAr: string }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const product of products) {
    keyboard.text(product.nameAr, `${CB.ORDER_PRODUCT}${product.id}`).row();
  }
  keyboard.text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
  return keyboard;
}

export function packageVideoListKeyboard(
  videos: { id: number; titleAr: string }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const video of videos) {
    keyboard.text(`🎬 ${video.titleAr}`, `${CB.ORDER_CONTENT}${video.id}`).row();
  }
  keyboard.text("↩️ رجوع", CB.ORDER).row();
  keyboard.text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
  return keyboard;
}

export function confirmOrderKeyboard(
  contentId: number,
  productId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ تأكيد الطلب", `${CB.CONFIRM_ORDER}${contentId}`)
    .row()
    .text("↩️ رجوع", `${CB.ORDER_PRODUCT}${productId}`)
    .row()
    .text("🏠 القائمة الرئيسية", CB.BACK_MAIN);
}

export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📦 الطلبات", CB.ADMIN_ORDERS)
    .row()
    .text("📚 المحتوى", CB.ADMIN_CONTENT)
    .row()
    .text("👥 العملاء", CB.ADMIN_CUSTOMERS)
    .row()
    .text("🔗 روابط الدعوة", CB.ADMIN_INVITES)
    .row()
    .text("⚙️ الإعدادات", CB.ADMIN_SETTINGS);
}

export function adminContentProductKeyboard(
  products: { id: string; nameAr: string }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const product of products) {
    keyboard
      .text(product.nameAr, `${CB.ADMIN_CONTENT_PRODUCT}${product.id}`)
      .row();
  }
  keyboard.text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
  return keyboard;
}

export function adminContentAddKeyboard(
  productId: string,
  contentType: string
): InlineKeyboard {
  return new InlineKeyboard().text(
    "↩️ إلغاء",
    `${CB.ADMIN_CONTENT_SECTION}${productId}:${contentType}`
  );
}

export function adminBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
}

export function adminOrderKeyboard(order: Order): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (isPendingOrderStatus(order.status)) {
    keyboard.text("✅ قبول الطلب", `${CB.ADMIN_APPROVE_ORDER}${order.id}`);
  }

  return keyboard;
}

export function buildApproveOrderCallback(orderId: number): string {
  return `${CB.ADMIN_APPROVE_ORDER}${orderId}`;
}

export function myProductsKeyboard(productIds: string[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const productId of productIds) {
    const product = getProductById(productId);
    if (!product) continue;
    keyboard.text(`📂 ${product.nameAr}`, `${CB.MY_PRODUCT}${product.id}`).row();
  }

  keyboard.text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
  return keyboard;
}

export function myVideosKeyboard(
  videos: { id: number; titleAr: string }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const video of videos) {
    keyboard.text(`🎬 ${video.titleAr}`, `${CB.MY_CONTENT_ITEM}${video.id}`).row();
  }

  keyboard.text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
  return keyboard;
}

export function myProductVideosKeyboard(
  videos: { id: number; titleAr: string }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const video of videos) {
    keyboard.text(`🎬 ${video.titleAr}`, `${CB.MY_CONTENT_ITEM}${video.id}`).row();
  }

  keyboard.text("↩️ منتجاتي", CB.MY_PRODUCTS_BACK);
  return keyboard;
}

export function myProductBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩️ منتجاتي", CB.MY_PRODUCTS_BACK);
}
