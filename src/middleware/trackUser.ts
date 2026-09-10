import type { Context, NextFunction } from "grammy";
import { upsertTelegramUser } from "../database/users";
import { logger } from "../utils/logger";

export async function trackTelegramUser(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  try {
    upsertTelegramUser(ctx.from);
  } catch (error) {
    logger.error("Failed to upsert Telegram user profile", error);
  }

  await next();
}
