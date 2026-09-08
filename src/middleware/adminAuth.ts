import type { Context, NextFunction } from "grammy";
import type { EnvConfig } from "../config/env";

export function createAdminMiddleware(config: EnvConfig) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const userId = ctx.from?.id;
    if (!userId || userId !== config.adminTelegramId) {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({
          text: "⛔ هذا الأمر متاح للمسؤول فقط.",
          show_alert: true,
        });
      } else {
        await ctx.reply("⛔ هذا الأمر متاح للمسؤول فقط.");
      }
      return;
    }
    await next();
  };
}

export function isAdmin(ctx: Context, adminTelegramId: number): boolean {
  return ctx.from?.id === adminTelegramId;
}
