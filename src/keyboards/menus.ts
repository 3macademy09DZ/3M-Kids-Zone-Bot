import { InlineKeyboard } from "grammy";
import type { AdminOrderSection, Order } from "../database/types";
import {
  isPaymentReviewStatus,
  isPendingOrderStatus,
} from "../database/types";
import { CONTENT_TYPE_EMOJI, type ContentType } from "../database/contentTypes";
import { getProductById } from "../data/products";
import { formatPriceDzd } from "../utils/price";

export const CB = {
  ABOUT: "about",
  ORDER: "order",
  CONTACT: "contact",
  BACK_MAIN: "back_main",
  ORDER_PRODUCT: "order_product:",
  ORDER_CONTENT: "order_content:",
  CONFIRM_ORDER: "confirm_order:",
  PAY_METHOD_CCP: "pay_method_ccp:",
  PAY_METHOD_REDOTPAY: "pay_method_redotpay:",
  PAY_RESUBMIT: "pay_resubmit:",
  ADMIN_ACCEPT_PAYMENT: "admin_accept_pay:",
  ADMIN_REJECT_PAYMENT: "admin_reject_pay:",
  MY_PRODUCTS: "my_products",
  MY_PRODUCT: "my_product:",
  ADMIN_ORDERS: "admin_orders",
  ADMIN_ORDERS_SECTION: "admin_os:",
  ADMIN_ORDER_VIEW: "admin_ov:",
  ADMIN_APPROVE_ORDER: "admin_approve_order:",
  ADMIN_CUSTOMERS: "admin_customers",
  ADMIN_INVITES: "admin_invites",
  ADMIN_SETTINGS: "admin_settings",
  ADMIN_BACK: "admin_back",
  ADMIN_CONTENT: "admin_content",
  ADMIN_CONTENT_PRODUCT: "admin_content_product:",
  ADMIN_CONTENT_SECTION: "admin_content_section:",
  ADMIN_CONTENT_ADD: "admin_content_add:",
  ADMIN_CONTENT_ITEM: "admin_content_item:",
  ADMIN_CONTENT_RENAME: "admin_content_rename:",
  ADMIN_CONTENT_PRICE: "admin_content_price:",
  ADMIN_CONTENT_DELETE: "admin_content_delete:",
  ADMIN_CONTENT_DELETE_CONFIRM: "admin_content_delete_confirm:",
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

function itemButtonLabel(
  titleAr: string,
  contentType: ContentType = "video",
  price?: number | null
): string {
  return `${CONTENT_TYPE_EMOJI[contentType]} ${titleAr} — ${formatPriceDzd(price)}`;
}

export function packageVideoListKeyboard(
  items: { id: number; titleAr: string; contentType?: ContentType; price?: number | null }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const item of items) {
    keyboard
      .text(
        itemButtonLabel(item.titleAr, item.contentType ?? "video", item.price),
        `${CB.ORDER_CONTENT}${item.id}`
      )
      .row();
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

export function paymentMethodKeyboard(orderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("💳 CCP / BaridiMob", `${CB.PAY_METHOD_CCP}${orderId}`)
    .row()
    .text("💳 RedotPay", `${CB.PAY_METHOD_REDOTPAY}${orderId}`)
    .row()
    .text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
}

export function resubmitPaymentKeyboard(orderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("📤 إعادة إرسال إثبات الدفع", `${CB.PAY_RESUBMIT}${orderId}`)
    .row()
    .text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
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

export function adminContentItemKeyboard(item: {
  id: number;
  productId: string;
  contentType: ContentType;
}): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ تغيير الاسم", `${CB.ADMIN_CONTENT_RENAME}${item.id}`)
    .row()
    .text("💰 تغيير السعر", `${CB.ADMIN_CONTENT_PRICE}${item.id}`)
    .row()
    .text("🗑️ حذف العنصر", `${CB.ADMIN_CONTENT_DELETE}${item.id}`)
    .row()
    .text(
      "↩️ رجوع",
      `${CB.ADMIN_CONTENT_SECTION}${item.productId}:${item.contentType}`
    );
}

export function adminContentRenameKeyboard(item: {
  id: number;
}): InlineKeyboard {
  return new InlineKeyboard().text(
    "↩️ إلغاء",
    `${CB.ADMIN_CONTENT_ITEM}${item.id}`
  );
}

export function adminContentPriceKeyboard(item: {
  id: number;
}): InlineKeyboard {
  return new InlineKeyboard().text(
    "↩️ إلغاء",
    `${CB.ADMIN_CONTENT_ITEM}${item.id}`
  );
}

export function adminContentDeleteConfirmKeyboard(item: {
  id: number;
}): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ نعم، احذف", `${CB.ADMIN_CONTENT_DELETE_CONFIRM}${item.id}`)
    .row()
    .text("↩️ إلغاء", `${CB.ADMIN_CONTENT_ITEM}${item.id}`);
}

export function adminBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
}

export function adminOrdersHubKeyboard(counts: Record<AdminOrderSection, number>): InlineKeyboard {
  return new InlineKeyboard()
    .text(`🔎 في انتظار مراجعة الدفع (${counts.review})`, `${CB.ADMIN_ORDERS_SECTION}review`)
    .row()
    .text(`⏳ في انتظار الدفع (${counts.wait})`, `${CB.ADMIN_ORDERS_SECTION}wait`)
    .row()
    .text(`✅ الطلبات المقبولة (${counts.approved})`, `${CB.ADMIN_ORDERS_SECTION}approved`)
    .row()
    .text(`❌ الطلبات المرفوضة (${counts.rejected})`, `${CB.ADMIN_ORDERS_SECTION}rejected`)
    .row()
    .text(`📋 كل الطلبات (${counts.all})`, `${CB.ADMIN_ORDERS_SECTION}all`)
    .row()
    .text("🔙 رجوع", CB.ADMIN_BACK);
}

export function adminEmptyOrderSectionKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔙 رجوع إلى الطلبات", CB.ADMIN_ORDERS);
}

export function adminPaymentProofNotifyKeyboard(orderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ قبول الدفع", `${CB.ADMIN_ACCEPT_PAYMENT}${orderId}`)
    .row()
    .text("❌ رفض الدفع", `${CB.ADMIN_REJECT_PAYMENT}${orderId}`)
    .row()
    .text("📂 فتح تفاصيل الطلب", `${CB.ADMIN_ORDER_VIEW}${orderId}:review`);
}

export function adminOrderSectionListKeyboard(input: {
  section: AdminOrderSection;
  orders: { id: number; displayNumber: string }[];
  page: number;
  totalPages: number;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const order of input.orders) {
    keyboard
      .text(`📂 فتح ${order.displayNumber}`, `${CB.ADMIN_ORDER_VIEW}${order.id}:${input.section}`)
      .row();
  }

  if (input.totalPages > 1) {
    if (input.page > 0) {
      keyboard.text("◀️ السابق", `${CB.ADMIN_ORDERS_SECTION}${input.section}:${input.page - 1}`);
    }
    if (input.page + 1 < input.totalPages) {
      keyboard.text("▶️ التالي", `${CB.ADMIN_ORDERS_SECTION}${input.section}:${input.page + 1}`);
    }
    keyboard.row();
  }

  keyboard.text("🔙 رجوع إلى الطلبات", CB.ADMIN_ORDERS);
  return keyboard;
}

export function adminOrderKeyboard(
  order: Order,
  backSection: AdminOrderSection = "all"
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (isPaymentReviewStatus(order.status) && order.paymentProofFileId) {
    keyboard
      .text("✅ قبول الدفع", `${CB.ADMIN_ACCEPT_PAYMENT}${order.id}`)
      .row()
      .text("❌ رفض الدفع", `${CB.ADMIN_REJECT_PAYMENT}${order.id}`)
      .row();
  } else if (
    (isPendingOrderStatus(order.status) || order.status === "awaiting_payment") &&
    !order.paymentProofFileId
  ) {
    keyboard
      .text(
        "⚠️ قبول يدوي (بدون إثبات)",
        `${CB.ADMIN_APPROVE_ORDER}${order.id}`
      )
      .row();
  }

  keyboard.text("🔙 رجوع إلى الطلبات", `${CB.ADMIN_ORDERS_SECTION}${backSection}`);
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
  items: { id: number; titleAr: string; contentType?: ContentType; price?: number | null }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const item of items) {
    keyboard
      .text(
        itemButtonLabel(item.titleAr, item.contentType ?? "video", item.price),
        `${CB.MY_CONTENT_ITEM}${item.id}`
      )
      .row();
  }

  keyboard.text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
  return keyboard;
}

export function myProductVideosKeyboard(
  items: { id: number; titleAr: string; contentType?: ContentType; price?: number | null }[]
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const item of items) {
    keyboard
      .text(
        itemButtonLabel(item.titleAr, item.contentType ?? "video", item.price),
        `${CB.MY_CONTENT_ITEM}${item.id}`
      )
      .row();
  }

  keyboard.text("↩️ منتجاتي", CB.MY_PRODUCTS_BACK);
  return keyboard;
}

export function myProductBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩️ منتجاتي", CB.MY_PRODUCTS_BACK);
}
