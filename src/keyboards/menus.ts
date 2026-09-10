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
  HELP: "help",
  HELP_BUY: "help_buy",
  HELP_PAY: "help_pay",
  HELP_PURCHASES: "help_my",
  HELP_PROMO: "help_promo",
  HELP_PROBLEM: "help_issue",
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
  ADMIN_STATS: "admin_stats",
  ADMIN_PROMO: "admin_promo",
  ADMIN_PROMO_NEW: "admin_pnw",
  ADMIN_PROMO_LIST: "admin_pl:",
  ADMIN_PROMO_VIEW: "admin_pv:",
  ADMIN_PROMO_TYPE_PERCENT: "admin_pt:p",
  ADMIN_PROMO_TYPE_FIXED: "admin_pt:f",
  ADMIN_PROMO_NO_EXPIRY: "admin_pe0",
  ADMIN_PROMO_UNLIMITED: "admin_pu0",
  ADMIN_PROMO_OFF: "admin_pof:",
  ADMIN_PROMO_ON: "admin_pon:",
  ADMIN_PROMO_DEL: "admin_pd:",
  ADMIN_PROMO_DEL_OK: "admin_pdc:",
  ADMIN_PROMO_CANCEL: "admin_px",
  PROMO_HAS: "promo_has:",
  PROMO_SKIP: "promo_skip:",
  PROMO_RETRY: "promo_try:",
  PROMO_CONFIRM: "promo_ok:",
  ADMIN_CUSTOMERS_PAGE: "admin_cu:",
  ADMIN_CUSTOMER_VIEW: "admin_cv:",
  ADMIN_CUSTOMER_PRODUCTS: "admin_cp:",
  ADMIN_CUSTOMER_ORDERS: "admin_co:",
  ADMIN_INVITES: "admin_invites",
  ADMIN_SETTINGS: "admin_settings",
  ADMIN_SET_CHANNEL: "aset_ch",
  ADMIN_SET_CONTACT: "aset_ct",
  ADMIN_SET_PAY: "aset_py",
  ADMIN_SET_ADMIN: "aset_ad",
  ADMIN_SET_CH_EDIT: "aset_che",
  ADMIN_SET_CH_ON: "aset_ch1",
  ADMIN_SET_CH_OFF: "aset_ch0",
  ADMIN_SET_CT_EDIT: "aset_cte",
  ADMIN_SET_CT_ON: "aset_ct1",
  ADMIN_SET_CT_OFF: "aset_ct0",
  ADMIN_SET_PAY_CCP: "aset_pcc",
  ADMIN_SET_PAY_RIP: "aset_pri",
  ADMIN_SET_PAY_NAME: "aset_pnm",
  ADMIN_SET_PAY_RDP: "aset_prd",
  ADMIN_SET_PAY_CCP_ON: "aset_pc1",
  ADMIN_SET_PAY_CCP_OFF: "aset_pc0",
  ADMIN_SET_PAY_RDP_ON: "aset_pr1",
  ADMIN_SET_PAY_RDP_OFF: "aset_pr0",
  ADMIN_SET_CANCEL: "aset_x",
  ADMIN_SET_ADMIN_USER: "aset_aue",
  ADMIN_SET_ADMIN_USER_DEL: "aset_aud",
  ADMIN_BACKUP: "admin_bak",
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

export function mainMenuKeyboard(options?: { showContact?: boolean }): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("🎓 التعرف على المحتوى", CB.ABOUT)
    .row()
    .text("🛒 طلب المحتوى", CB.ORDER)
    .row()
    .text("📦 منتجاتي", CB.MY_PRODUCTS)
    .row();

  if (options?.showContact !== false) {
    keyboard.text("📞 التواصل معنا", CB.CONTACT).row();
  }

  keyboard.text("❓ المساعدة", CB.HELP).row();
  return keyboard;
}

export function helpMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🛒 كيف أشتري؟", CB.HELP_BUY)
    .row()
    .text("💳 كيف أدفع؟", CB.HELP_PAY)
    .row()
    .text("📦 أين أجد مشترياتي؟", CB.HELP_PURCHASES)
    .row()
    .text("🎟️ كيف أستخدم كود الخصم؟", CB.HELP_PROMO)
    .row()
    .text("❓ لدي مشكلة", CB.HELP_PROBLEM)
    .row()
    .text("🔙 رجوع", CB.BACK_MAIN);
}

export function helpTopicBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔙 رجوع", CB.HELP);
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

export function promoChoiceKeyboard(
  contentId: number,
  productId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎟️ لدي كود تخفيض", `${CB.PROMO_HAS}${contentId}`)
    .row()
    .text("➡️ متابعة بدون كود", `${CB.PROMO_SKIP}${contentId}`)
    .row()
    .text("↩️ رجوع", `${CB.ORDER_PRODUCT}${productId}`)
    .row()
    .text("🏠 القائمة الرئيسية", CB.BACK_MAIN);
}

export function promoInvalidKeyboard(contentId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 إدخال كود آخر", `${CB.PROMO_RETRY}${contentId}`)
    .row()
    .text("➡️ متابعة بدون كود", `${CB.PROMO_SKIP}${contentId}`)
    .row()
    .text("🏠 القائمة الرئيسية", CB.BACK_MAIN);
}

export function promoConfirmKeyboard(
  contentId: number,
  productId: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ تأكيد الطلب", `${CB.PROMO_CONFIRM}${contentId}`)
    .row()
    .text("↩️ رجوع", `${CB.ORDER_PRODUCT}${productId}`)
    .row()
    .text("🏠 القائمة الرئيسية", CB.BACK_MAIN);
}

export function adminPromoHubKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ إنشاء كود جديد", CB.ADMIN_PROMO_NEW)
    .row()
    .text("📋 الأكواد الحالية", `${CB.ADMIN_PROMO_LIST}0`)
    .row()
    .text("🔙 رجوع", CB.ADMIN_BACK);
}

export function adminPromoCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("↩️ إلغاء", CB.ADMIN_PROMO_CANCEL);
}

export function adminPromoTypeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("نسبة مئوية %", CB.ADMIN_PROMO_TYPE_PERCENT)
    .row()
    .text("مبلغ ثابت بالدينار", CB.ADMIN_PROMO_TYPE_FIXED)
    .row()
    .text("↩️ إلغاء", CB.ADMIN_PROMO_CANCEL);
}

export function adminPromoExpiryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("بدون تاريخ انتهاء", CB.ADMIN_PROMO_NO_EXPIRY)
    .row()
    .text("↩️ إلغاء", CB.ADMIN_PROMO_CANCEL);
}

export function adminPromoMaxUsesKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("غير محدود", CB.ADMIN_PROMO_UNLIMITED)
    .row()
    .text("↩️ إلغاء", CB.ADMIN_PROMO_CANCEL);
}

export function adminPromoListKeyboard(input: {
  promos: { id: number; code: string }[];
  page: number;
  totalPages: number;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const promo of input.promos) {
    keyboard.text(`🎟️ ${promo.code}`, `${CB.ADMIN_PROMO_VIEW}${promo.id}`).row();
  }

  if (input.totalPages > 1) {
    if (input.page > 0) {
      keyboard.text("◀️ السابق", `${CB.ADMIN_PROMO_LIST}${input.page - 1}`);
    }
    if (input.page + 1 < input.totalPages) {
      keyboard.text("▶️ التالي", `${CB.ADMIN_PROMO_LIST}${input.page + 1}`);
    }
    keyboard.row();
  }

  keyboard.text("🔙 رجوع", CB.ADMIN_PROMO);
  return keyboard;
}

export function adminPromoViewKeyboard(input: {
  id: number;
  isActive: boolean;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (input.isActive) {
    keyboard.text("⏸️ تعطيل الكود", `${CB.ADMIN_PROMO_OFF}${input.id}`).row();
  } else {
    keyboard.text("▶️ تفعيل الكود", `${CB.ADMIN_PROMO_ON}${input.id}`).row();
  }
  keyboard
    .text("🗑️ حذف الكود", `${CB.ADMIN_PROMO_DEL}${input.id}`)
    .row()
    .text("🔙 رجوع", `${CB.ADMIN_PROMO_LIST}0`);
  return keyboard;
}

export function adminPromoDeleteConfirmKeyboard(id: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ نعم، احذف", `${CB.ADMIN_PROMO_DEL_OK}${id}`)
    .row()
    .text("↩️ إلغاء", `${CB.ADMIN_PROMO_VIEW}${id}`);
}

export function paymentMethodKeyboard(
  orderId: number,
  options?: { ccp?: boolean; redotpay?: boolean }
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const showCcp = options?.ccp !== false;
  const showRedotpay = options?.redotpay !== false;

  if (showCcp) {
    keyboard.text("💳 CCP / BaridiMob", `${CB.PAY_METHOD_CCP}${orderId}`).row();
  }
  if (showRedotpay) {
    keyboard.text("💳 RedotPay", `${CB.PAY_METHOD_REDOTPAY}${orderId}`).row();
  }

  keyboard.text("↩️ القائمة الرئيسية", CB.BACK_MAIN);
  return keyboard;
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
    .text("📊 إحصائيات المبيعات", CB.ADMIN_STATS)
    .row()
    .text("🎟️ أكواد التخفيض", CB.ADMIN_PROMO)
    .row()
    .text("💾 نسخة احتياطية", CB.ADMIN_BACKUP)
    .row()
    .text("🔗 روابط الدعوة", CB.ADMIN_INVITES)
    .row()
    .text("⚙️ الإعدادات", CB.ADMIN_SETTINGS);
}

export function adminSettingsHubKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📣 إعدادات القناة", CB.ADMIN_SET_CHANNEL)
    .row()
    .text("☎️ إعدادات التواصل", CB.ADMIN_SET_CONTACT)
    .row()
    .text("💳 إعدادات الدفع", CB.ADMIN_SET_PAY)
    .row()
    .text("👤 بيانات المسؤول", CB.ADMIN_SET_ADMIN)
    .row()
    .text("🔙 رجوع", CB.ADMIN_BACK);
}

export function adminSettingsChannelKeyboard(enabled: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ تغيير القناة", CB.ADMIN_SET_CH_EDIT)
    .row()
    .text(
      enabled ? "❌ تعطيل استخدام القناة" : "✅ تفعيل استخدام القناة",
      enabled ? CB.ADMIN_SET_CH_OFF : CB.ADMIN_SET_CH_ON
    )
    .row()
    .text("🔙 رجوع", CB.ADMIN_SETTINGS);
}

export function adminSettingsContactKeyboard(enabled: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ تغيير اسم التواصل", CB.ADMIN_SET_CT_EDIT)
    .row()
    .text(
      enabled ? "❌ تعطيل زر التواصل" : "✅ تفعيل زر التواصل",
      enabled ? CB.ADMIN_SET_CT_OFF : CB.ADMIN_SET_CT_ON
    )
    .row()
    .text("🔙 رجوع", CB.ADMIN_SETTINGS);
}

export function adminSettingsPaymentKeyboard(input: {
  ccpEnabled: boolean;
  redotpayEnabled: boolean;
}): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ تعديل معلومات CCP", CB.ADMIN_SET_PAY_CCP)
    .row()
    .text("✏️ تعديل RIP BaridiMob", CB.ADMIN_SET_PAY_RIP)
    .row()
    .text("✏️ تعديل اسم صاحب الحساب", CB.ADMIN_SET_PAY_NAME)
    .row()
    .text("✏️ تعديل معلومات RedotPay", CB.ADMIN_SET_PAY_RDP)
    .row()
    .text(
      input.ccpEnabled ? "❌ تعطيل CCP / BaridiMob" : "✅ تفعيل CCP / BaridiMob",
      input.ccpEnabled ? CB.ADMIN_SET_PAY_CCP_OFF : CB.ADMIN_SET_PAY_CCP_ON
    )
    .row()
    .text(
      input.redotpayEnabled ? "❌ تعطيل RedotPay" : "✅ تفعيل RedotPay",
      input.redotpayEnabled ? CB.ADMIN_SET_PAY_RDP_OFF : CB.ADMIN_SET_PAY_RDP_ON
    )
    .row()
    .text("🔙 رجوع", CB.ADMIN_SETTINGS);
}

export function adminSettingsAdminKeyboard(hasUsername: boolean): InlineKeyboard {
  const keyboard = new InlineKeyboard()
    .text("✏️ تعديل Username المسؤول", CB.ADMIN_SET_ADMIN_USER)
    .row();

  if (hasUsername) {
    keyboard.text("🗑️ حذف Username", CB.ADMIN_SET_ADMIN_USER_DEL).row();
  }

  keyboard.text("🔙 رجوع", CB.ADMIN_SETTINGS);
  return keyboard;
}

export function adminSettingsCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("❌ إلغاء", CB.ADMIN_SET_CANCEL);
}

export function adminSettingsBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔙 رجوع", CB.ADMIN_SETTINGS);
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

export function adminStatsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 تحديث الإحصائيات", CB.ADMIN_STATS)
    .row()
    .text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
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

export function adminCustomersListKeyboard(input: {
  customerIds: number[];
  page: number;
  totalPages: number;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const customerId of input.customerIds) {
    keyboard
      .text("👤 فتح العميل", `${CB.ADMIN_CUSTOMER_VIEW}${customerId}`)
      .row();
  }

  if (input.totalPages > 1) {
    if (input.page > 0) {
      keyboard.text("⬅️ السابق", `${CB.ADMIN_CUSTOMERS_PAGE}${input.page - 1}`);
    }
    if (input.page + 1 < input.totalPages) {
      keyboard.text("التالي ➡️", `${CB.ADMIN_CUSTOMERS_PAGE}${input.page + 1}`);
    }
    keyboard.row();
  }

  keyboard.text("↩️ لوحة الإدارة", CB.ADMIN_BACK);
  return keyboard;
}

export function adminCustomerCardKeyboard(input: {
  telegramUserId: number;
  purchasedCount: number;
}): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      `📦 المنتجات المشتراة (${input.purchasedCount})`,
      `${CB.ADMIN_CUSTOMER_PRODUCTS}${input.telegramUserId}`
    )
    .row()
    .text("🧾 طلبات العميل", `${CB.ADMIN_CUSTOMER_ORDERS}${input.telegramUserId}`)
    .row()
    .text("🔙 رجوع إلى العملاء", CB.ADMIN_CUSTOMERS);
}

export function adminCustomerProductsKeyboard(telegramUserId: number): InlineKeyboard {
  return new InlineKeyboard().text(
    "🔙 رجوع إلى العميل",
    `${CB.ADMIN_CUSTOMER_VIEW}${telegramUserId}`
  );
}

export function adminCustomerOrdersKeyboard(input: {
  telegramUserId: number;
  orders: { id: number; displayNumber: string }[];
  page: number;
  totalPages: number;
}): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const order of input.orders) {
    keyboard
      .text(`📂 فتح ${order.displayNumber}`, `${CB.ADMIN_ORDER_VIEW}${order.id}:all`)
      .row();
  }

  if (input.totalPages > 1) {
    if (input.page > 0) {
      keyboard.text(
        "⬅️ السابق",
        `${CB.ADMIN_CUSTOMER_ORDERS}${input.telegramUserId}:${input.page - 1}`
      );
    }
    if (input.page + 1 < input.totalPages) {
      keyboard.text(
        "التالي ➡️",
        `${CB.ADMIN_CUSTOMER_ORDERS}${input.telegramUserId}:${input.page + 1}`
      );
    }
    keyboard.row();
  }

  keyboard.text("🔙 رجوع إلى العميل", `${CB.ADMIN_CUSTOMER_VIEW}${input.telegramUserId}`);
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
