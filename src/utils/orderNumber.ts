import type { Order, PaymentMethod } from "../database/types";

export function formatOrderNumber(id: number): string {
  return `3M-${String(id).padStart(6, "0")}`;
}

export function getOrderDisplayNumber(order: {
  id: number;
  orderNumber?: string | null;
}): string {
  const stored = order.orderNumber?.trim();
  return stored && stored.length > 0 ? stored : formatOrderNumber(order.id);
}

export function formatApprovalDate(raw: string | null | undefined): string {
  if (!raw) {
    return formatDate(new Date());
  }

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return formatDate(date);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-DZ", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const METHOD_NAMES: Record<PaymentMethod, string> = {
  ccp: "CCP / BaridiMob",
  redotpay: "RedotPay",
};

export function buildPurchaseReceipt(input: {
  order: Order;
  productName: string;
  priceLabel: string;
}): string {
  const method = input.order.paymentMethod
    ? METHOD_NAMES[input.order.paymentMethod]
    : "غير محدد";

  return (
    "✅ تم تأكيد الدفع بنجاح\n\n" +
    "🧾 إيصال الطلب\n" +
    `رقم الطلب: ${getOrderDisplayNumber(input.order)}\n` +
    `📦 المنتج: ${input.productName}\n` +
    `💰 السعر: ${input.priceLabel}\n` +
    `💳 طريقة الدفع: ${method}\n` +
    `📅 التاريخ: ${formatApprovalDate(input.order.paymentReviewedAt)}\n` +
    "الحالة: ✅ مدفوع ومقبول\n\n" +
    "شكرًا لاختياركم 3M Kids Zone 💜"
  );
}
