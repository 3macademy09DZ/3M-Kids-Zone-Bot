import { Bot } from "grammy";
import type { EnvConfig } from "./config/env";
import { CB } from "./keyboards/menus";
import { createAdminMiddleware } from "./middleware/adminAuth";
import { InviteLinkService } from "./services/inviteLink";
import { logger } from "./utils/logger";
import { getDatabase } from "./database/db";

import { handleStart, handleBackToMain, handleAboutContent, handleContact } from "./handlers/start";
import {
  handleOrderMenu,
  handleProductSelect,
  handleConfirmOrder,
} from "./handlers/order";
import {
  handleAdminCommand,
  handleAdminBack,
  handleAdminOrders,
  handleAdminCustomers,
  handleAdminInvites,
  handleAdminSettings,
} from "./handlers/admin";

export function createBot(config: EnvConfig): Bot {
  getDatabase();

  const bot = new Bot(config.botToken);
  const inviteLinkService = new InviteLinkService(bot.api, config.channelId);
  const adminOnly = createAdminMiddleware(config);

  bot.command("start", handleStart);

  bot.command("admin", adminOnly, handleAdminCommand);

  bot.callbackQuery(CB.BACK_MAIN, handleBackToMain);
  bot.callbackQuery(CB.ABOUT, handleAboutContent);
  bot.callbackQuery(CB.CONTACT, (ctx) => handleContact(ctx, config));
  bot.callbackQuery(CB.ORDER, handleOrderMenu);

  bot.callbackQuery(new RegExp(`^${CB.ORDER_PRODUCT}(.+)$`), async (ctx) => {
    const productId = ctx.match![1];
    await handleProductSelect(ctx, productId);
  });

  bot.callbackQuery(new RegExp(`^${CB.CONFIRM_ORDER}(.+)$`), async (ctx) => {
    const productId = ctx.match![1];
    await handleConfirmOrder(ctx, productId);
  });

  bot.callbackQuery(CB.ADMIN_BACK, adminOnly, handleAdminBack);
  bot.callbackQuery(CB.ADMIN_ORDERS, adminOnly, handleAdminOrders);
  bot.callbackQuery(CB.ADMIN_CUSTOMERS, adminOnly, handleAdminCustomers);
  bot.callbackQuery(CB.ADMIN_INVITES, adminOnly, (ctx) =>
    handleAdminInvites(ctx, inviteLinkService)
  );
  bot.callbackQuery(CB.ADMIN_SETTINGS, adminOnly, (ctx) =>
    handleAdminSettings(ctx, config, inviteLinkService)
  );

  bot.catch((err) => {
    logger.error("Bot error", err.error);
  });

  return bot;
}

export async function startBot(config: EnvConfig): Promise<void> {
  const bot = createBot(config);

  logger.info("Starting 3M Kids Zone bot…");

  await bot.start({
    onStart: () => {
      logger.info("Bot is running");
    },
  });
}
