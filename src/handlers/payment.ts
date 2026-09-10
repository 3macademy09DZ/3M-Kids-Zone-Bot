import type { Context } from "grammy";
import { TELEGRAM_CHECKOUT_DISABLED_ALERT } from "../config/academy";
import type { EnvConfig } from "../config/env";
import { formatContactLink } from "../config/env";
import { isContactActive, resolveAppSettings } from "../config/appSettings";
import type { PaymentMethod } from "../database/types";
import { resubmitPaymentKeyboard } from "../keyboards/menus";
import { clearPaymentProofSession } from "../state/paymentSession";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ccp: "💳 CCP / BaridiMob",
  redotpay: "💳 RedotPay",
};

export async function handleSelectPaymentMethod(
  ctx: Context,
  _orderId: number,
  _method: PaymentMethod,
  _config: EnvConfig
): Promise<void> {
  if (ctx.from) {
    clearPaymentProofSession(ctx.from.id);
  }
  await ctx.answerCallbackQuery({
    text: TELEGRAM_CHECKOUT_DISABLED_ALERT,
    show_alert: true,
  });
}

export async function handleResubmitPayment(
  ctx: Context,
  _orderId: number,
  _config: EnvConfig
): Promise<void> {
  if (ctx.from) {
    clearPaymentProofSession(ctx.from.id);
  }
  await ctx.answerCallbackQuery({
    text: TELEGRAM_CHECKOUT_DISABLED_ALERT,
    show_alert: true,
  });
}

export async function handleCustomerPaymentProof(
  ctx: Context,
  _config: EnvConfig
): Promise<boolean> {
  const user = ctx.from;
  if (!user) {
    return false;
  }

  clearPaymentProofSession(user.id);
  return false;
}

export function buildRejectedPaymentMessage(
  config: EnvConfig,
  orderId: number
): { text: string; keyboard: ReturnType<typeof resubmitPaymentKeyboard> } {
  const settings = resolveAppSettings(config);
  const contactLink = formatContactLink(settings.contactUsername);
  let text =
    "❌ مسار الدفع داخل تيليجرام معطّل.\n\n" +
    "الشراء والوصول إلى المحتوى سيتم عبر منصة 3M Academy.";

  if (isContactActive(settings) && contactLink && settings.contactUsername) {
    const display = settings.contactUsername.startsWith("@")
      ? settings.contactUsername
      : `@${settings.contactUsername}`;
    text += `\n\n📞 ${display}`;
  }

  return { text, keyboard: resubmitPaymentKeyboard(orderId) };
}
