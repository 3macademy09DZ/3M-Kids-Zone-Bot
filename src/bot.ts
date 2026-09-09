import { Bot } from "grammy";
import type { EnvConfig } from "./config/env";
import { CB } from "./keyboards/menus";
import { createAdminMiddleware } from "./middleware/adminAuth";
import { InviteLinkService } from "./services/inviteLink";
import { logger } from "./utils/logger";
import { getDatabase } from "./database/db";
import type { ContentType } from "./database/contentTypes";

import { handleStart, handleBackToMain, handleAboutContent, handleContact } from "./handlers/start";
import {
  handleOrderMenu,
  handleProductSelect,
  handleVideoSelect,
  handleConfirmOrder,
} from "./handlers/order";
import {
  handleAdminCommand,
  handleAdminBack,
  handleAdminOrders,
  handleAdminApproveOrder,
  handleAdminCustomers,
  handleAdminInvites,
  handleAdminSettings,
} from "./handlers/admin";
import {
  handleAdminContentMenu,
  handleAdminContentProduct,
  handleAdminContentSection,
  handleAdminContentAdd,
  handleAdminContentUpload,
} from "./handlers/adminContent";
import {
  handleMyProducts,
  handleMyProductsOpen,
  handleMyProductOpen,
  handleMyProductsBack,
  handleMyContentSection,
  handleMyContentItemOpen,
} from "./handlers/myProducts";

export function createBot(config: EnvConfig): Bot {
  getDatabase();

  const bot = new Bot(config.botToken);
  const inviteLinkService = new InviteLinkService(bot.api, config.channelId);
  const adminOnly = createAdminMiddleware(config);

  bot.command("start", handleStart);
  bot.command("myproducts", handleMyProducts);

  bot.command("admin", adminOnly, handleAdminCommand);

  bot.callbackQuery(CB.BACK_MAIN, handleBackToMain);
  bot.callbackQuery(CB.ABOUT, handleAboutContent);
  bot.callbackQuery(CB.CONTACT, (ctx) => handleContact(ctx, config));
  bot.callbackQuery(CB.ORDER, handleOrderMenu);

  bot.callbackQuery(new RegExp(`^${CB.ORDER_PRODUCT}(.+)$`), async (ctx) => {
    const productId = ctx.match![1];
    await handleProductSelect(ctx, productId);
  });

  bot.callbackQuery(new RegExp(`^${CB.ORDER_CONTENT}(\\d+)$`), async (ctx) => {
    const contentId = Number(ctx.match![1]);
    await handleVideoSelect(ctx, contentId);
  });

  bot.callbackQuery(new RegExp(`^${CB.CONFIRM_ORDER}(\\d+)$`), async (ctx) => {
    const contentId = Number(ctx.match![1]);
    await handleConfirmOrder(ctx, contentId);
  });

  bot.callbackQuery(CB.ADMIN_BACK, adminOnly, handleAdminBack);
  bot.callbackQuery(CB.ADMIN_ORDERS, adminOnly, handleAdminOrders);
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_APPROVE_ORDER}(\\d+)$`), adminOnly, async (ctx) => {
    const orderId = Number(ctx.match![1]);
    await handleAdminApproveOrder(ctx, orderId);
  });
  bot.callbackQuery(CB.ADMIN_CONTENT, adminOnly, handleAdminContentMenu);
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_PRODUCT}(.+)$`), adminOnly, async (ctx) => {
    const productId = ctx.match![1];
    await handleAdminContentProduct(ctx, productId);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_SECTION}(.+):(video|game|file)$`), adminOnly, async (ctx) => {
    const productId = ctx.match![1];
    const contentType = ctx.match![2] as ContentType;
    await handleAdminContentSection(ctx, productId, contentType);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_ADD}(.+):(video|game|file)$`), adminOnly, async (ctx) => {
    const productId = ctx.match![1];
    const contentType = ctx.match![2] as ContentType;
    await handleAdminContentAdd(ctx, productId, contentType);
  });
  bot.callbackQuery(CB.ADMIN_CUSTOMERS, adminOnly, handleAdminCustomers);
  bot.callbackQuery(CB.ADMIN_INVITES, adminOnly, (ctx) =>
    handleAdminInvites(ctx, inviteLinkService)
  );
  bot.callbackQuery(CB.ADMIN_SETTINGS, adminOnly, (ctx) =>
    handleAdminSettings(ctx, config, inviteLinkService)
  );

  bot.callbackQuery(CB.MY_PRODUCTS, handleMyProductsOpen);
  bot.callbackQuery(CB.MY_PRODUCTS_BACK, handleMyProductsBack);
  bot.callbackQuery(new RegExp(`^${CB.MY_PRODUCT}(.+)$`), async (ctx) => {
    const productId = ctx.match![1];
    await handleMyProductOpen(ctx, productId);
  });
  bot.callbackQuery(new RegExp(`^${CB.MY_CONTENT_SECTION}(.+):(video|game|file)$`), async (ctx) => {
    const productId = ctx.match![1];
    const contentType = ctx.match![2] as ContentType;
    await handleMyContentSection(ctx, productId, contentType);
  });
  bot.callbackQuery(new RegExp(`^${CB.MY_CONTENT_ITEM}(\\d+)$`), async (ctx) => {
    const contentItemId = Number(ctx.match![1]);
    await handleMyContentItemOpen(ctx, contentItemId);
  });

  bot.on("message", adminOnly, async (ctx, next) => {
    const handled = await handleAdminContentUpload(ctx);
    if (!handled) {
      await next();
    }
  });

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
