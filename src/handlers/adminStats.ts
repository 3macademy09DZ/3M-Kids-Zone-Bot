import type { Context } from "grammy";
import { adminStatsKeyboard } from "../keyboards/menus";
import { computeSalesStats, formatSalesStatsMessage } from "../utils/salesStats";

export async function handleAdminStats(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  const stats = computeSalesStats();
  await ctx.editMessageText(formatSalesStatsMessage(stats), {
    reply_markup: adminStatsKeyboard(),
  });
}
