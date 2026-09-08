import { InlineKeyboard } from "grammy";

export const CB = {
  ABOUT: "about",
  ORDER: "order",
  CONTACT: "contact",
  BACK_MAIN: "back_main",
  ORDER_PRODUCT: "order_product:",
  CONFIRM_ORDER: "confirm_order:",
  ADMIN_ORDERS: "admin_orders",
  ADMIN_CUSTOMERS: "admin_customers",
  ADMIN_INVITES: "admin_invites",
  ADMIN_SETTINGS: "admin_settings",
  ADMIN_BACK: "admin_back",
} as const;

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎓 التعرف على المحتوى", CB.ABOUT)
    .row()
    .text("🛒 طلب المحتوى", CB.ORDER)
    .row()
    .text("📞 التواصل معنا", CB.CONTACT);
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

export function confirmOrderKeyboard(productId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ تأكيد الطلب", `${CB.CONFIRM_ORDER}${productId}`)
    .row()
    .text("↩️ رجوع", CB.ORDER)
    .row()
    .text("🏠 القائمة الرئيسية", CB.BACK_MAIN);
}

export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📦 الطلبات", CB.ADMIN_ORDERS)
    .row()
    .text("👥 العملاء", CB.ADMIN_CUSTOMERS)
    .row()
    .text("🔗 روابط الدعوة", CB.ADMIN_INVITES)
    .row()
    .text("⚙️ الإعدادات", CB.ADMIN_SETTINGS);
}

export function adminBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
}
