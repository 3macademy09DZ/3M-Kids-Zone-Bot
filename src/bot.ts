import { Bot } from "grammy";
import type { EnvConfig } from "./config/env";
import { CB } from "./keyboards/menus";
import { createAdminMiddleware, isAdmin } from "./middleware/adminAuth";
import { trackTelegramUser } from "./middleware/trackUser";
import { InviteLinkService } from "./services/inviteLink";
import { logger } from "./utils/logger";
import { getDatabase } from "./database/db";
import type { ContentType } from "./database/contentTypes";

import { handleStart, handleBackToMain, handleAboutContent, handleContact } from "./handlers/start";
import {
  handleHelpBuy,
  handleHelpMenu,
  handleHelpPay,
  handleHelpPromo,
  handleHelpPurchases,
} from "./handlers/help";
import {
  handleSupportCancel,
  handleSupportStart,
  handleSupportTicketInput,
  handleCustomerSupportReplyStart,
} from "./handlers/support";
import {
  handleOrderMenu,
  handleProductSelect,
  handleVideoSelect,
  handleConfirmOrder,
  handlePromoHas,
  handlePromoSkip,
  handlePromoRetry,
  handlePromoConfirm,
  handleCheckoutPromoInput,
  handleAcademyDetailsInfo,
} from "./handlers/order";
import type { AdminOrderSection } from "./database/types";
import {
  handleAdminCommand,
  handleAdminBack,
  handleAdminOrders,
  handleAdminOrderSection,
  handleAdminOrderView,
  handleAdminApproveOrder,
  handleAdminAcceptPayment,
  handleAdminRejectPayment,
  handleAdminInvites,
} from "./handlers/admin";
import { handleAdminBackup } from "./handlers/adminBackup";
import {
  handleAdminSettings,
  handleAdminSettingsAdmin,
  handleAdminSettingsCancel,
  handleAdminSettingsChannel,
  handleAdminSettingsContact,
  handleAdminSettingsInput,
  handleAdminSettingsPayment,
  handleAdminSettingsStartEdit,
  handleAdminSettingsToggle,
  handleAdminSettingsDeleteAdminUsername,
} from "./handlers/adminSettings";
import { SETTINGS_KEYS } from "./database/settings";
import {
  handleAdminCustomers,
  handleAdminCustomerView,
  handleAdminCustomerProducts,
  handleAdminCustomerOrders,
} from "./handlers/adminCustomers";
import { handleAdminStats } from "./handlers/adminStats";
import {
  handleAdminPromoMenu,
  handleAdminPromoNew,
  handleAdminPromoList,
  handleAdminPromoView,
  handleAdminPromoSetActive,
  handleAdminPromoDeleteAsk,
  handleAdminPromoDeleteConfirm,
  handleAdminPromoType,
  handleAdminPromoNoExpiry,
  handleAdminPromoUnlimited,
  handleAdminPromoCancel,
  handleAdminPromoInput,
} from "./handlers/adminPromo";
import {
  handleAdminSupportCloseAsk,
  handleAdminSupportCloseConfirm,
  handleAdminSupportHub,
  handleAdminSupportList,
  handleAdminSupportReplyCancel,
  handleAdminSupportReplyInput,
  handleAdminSupportReplyStart,
  handleAdminSupportView,
} from "./handlers/adminSupport";
import {
  handleCustomerPaymentProof,
  handleResubmitPayment,
  handleSelectPaymentMethod,
} from "./handlers/payment";
import {
  handleAdminContentMenu,
  handleAdminContentProduct,
  handleAdminContentSection,
  handleAdminContentAdd,
  handleAdminContentItem,
  handleAdminContentRename,
  handleAdminContentPrice,
  handleAdminContentDelete,
  handleAdminContentDeleteConfirm,
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
  const inviteLinkService = new InviteLinkService(bot.api, config);
  const adminOnly = createAdminMiddleware(config);

  bot.use(trackTelegramUser);

  bot.command("start", handleStart);
  bot.command("myproducts", handleMyProducts);
  bot.command("help", handleHelpMenu);

  bot.command("admin", adminOnly, handleAdminCommand);

  bot.callbackQuery(CB.BACK_MAIN, handleBackToMain);
  bot.callbackQuery(CB.ABOUT, handleAboutContent);
  bot.callbackQuery(CB.CONTACT, (ctx) => handleContact(ctx, config));
  bot.callbackQuery(CB.HELP, handleHelpMenu);
  bot.callbackQuery(CB.HELP_BUY, handleHelpBuy);
  bot.callbackQuery(CB.HELP_PAY, (ctx) => handleHelpPay(ctx, config));
  bot.callbackQuery(CB.HELP_PURCHASES, handleHelpPurchases);
  bot.callbackQuery(CB.HELP_PROMO, handleHelpPromo);
  bot.callbackQuery(CB.HELP_PROBLEM, handleSupportStart);
  bot.callbackQuery(CB.HELP_SUPPORT_CANCEL, handleSupportCancel);
  bot.callbackQuery(
    new RegExp(`^${CB.SUPPORT_REPLY_CANCEL}(\\d+)$`),
    handleSupportCancel
  );
  bot.callbackQuery(
    new RegExp(`^${CB.SUPPORT_REPLY}(\\d+)$`),
    async (ctx) => {
      await handleCustomerSupportReplyStart(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(CB.ORDER, handleOrderMenu);

  bot.callbackQuery(new RegExp(`^${CB.ORDER_PRODUCT}(.+)$`), async (ctx) => {
    const productId = ctx.match![1];
    await handleProductSelect(ctx, productId);
  });

  bot.callbackQuery(new RegExp(`^${CB.ORDER_CONTENT}(\\d+)$`), async (ctx) => {
    const contentId = Number(ctx.match![1]);
    await handleVideoSelect(ctx, contentId);
  });
  bot.callbackQuery(CB.ACADEMY_DETAILS, handleAcademyDetailsInfo);

  bot.callbackQuery(new RegExp(`^${CB.CONFIRM_ORDER}(\\d+)$`), async (ctx) => {
    const contentId = Number(ctx.match![1]);
    await handleConfirmOrder(ctx, contentId);
  });
  bot.callbackQuery(new RegExp(`^${CB.PROMO_HAS}(\\d+)$`), async (ctx) => {
    await handlePromoHas(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(new RegExp(`^${CB.PROMO_SKIP}(\\d+)$`), async (ctx) => {
    await handlePromoSkip(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(new RegExp(`^${CB.PROMO_RETRY}(\\d+)$`), async (ctx) => {
    await handlePromoRetry(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(new RegExp(`^${CB.PROMO_CONFIRM}(\\d+)$`), async (ctx) => {
    await handlePromoConfirm(ctx, Number(ctx.match![1]));
  });

  bot.callbackQuery(new RegExp(`^${CB.PAY_METHOD_CCP}(\\d+)$`), async (ctx) => {
    const orderId = Number(ctx.match![1]);
    await handleSelectPaymentMethod(ctx, orderId, "ccp", config);
  });
  bot.callbackQuery(new RegExp(`^${CB.PAY_METHOD_REDOTPAY}(\\d+)$`), async (ctx) => {
    const orderId = Number(ctx.match![1]);
    await handleSelectPaymentMethod(ctx, orderId, "redotpay", config);
  });
  bot.callbackQuery(new RegExp(`^${CB.PAY_RESUBMIT}(\\d+)$`), async (ctx) => {
    const orderId = Number(ctx.match![1]);
    await handleResubmitPayment(ctx, orderId, config);
  });

  bot.callbackQuery(CB.ADMIN_BACK, adminOnly, handleAdminBack);
  bot.callbackQuery(CB.ADMIN_ORDERS, adminOnly, handleAdminOrders);
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_ORDERS_SECTION}(review|wait|approved|rejected|all)(?::(\\d+))?$`),
    adminOnly,
    async (ctx) => {
      const section = ctx.match![1] as AdminOrderSection;
      const page = ctx.match![2] ? Number(ctx.match![2]) : 0;
      await handleAdminOrderSection(ctx, section, page);
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_ORDER_VIEW}(\\d+):(review|wait|approved|rejected|all)$`),
    adminOnly,
    async (ctx) => {
      const orderId = Number(ctx.match![1]);
      const section = ctx.match![2] as AdminOrderSection;
      await handleAdminOrderView(ctx, orderId, section);
    }
  );
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_APPROVE_ORDER}(\\d+)$`), adminOnly, async (ctx) => {
    const orderId = Number(ctx.match![1]);
    await handleAdminApproveOrder(ctx, orderId);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_ACCEPT_PAYMENT}(\\d+)$`), adminOnly, async (ctx) => {
    const orderId = Number(ctx.match![1]);
    await handleAdminAcceptPayment(ctx, orderId);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_REJECT_PAYMENT}(\\d+)$`), adminOnly, async (ctx) => {
    const orderId = Number(ctx.match![1]);
    await handleAdminRejectPayment(ctx, orderId, config);
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
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_ITEM}(\\d+)$`), adminOnly, async (ctx) => {
    const contentItemId = Number(ctx.match![1]);
    await handleAdminContentItem(ctx, contentItemId);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_RENAME}(\\d+)$`), adminOnly, async (ctx) => {
    const contentItemId = Number(ctx.match![1]);
    await handleAdminContentRename(ctx, contentItemId);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_PRICE}(\\d+)$`), adminOnly, async (ctx) => {
    const contentItemId = Number(ctx.match![1]);
    await handleAdminContentPrice(ctx, contentItemId);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_DELETE_CONFIRM}(\\d+)$`), adminOnly, async (ctx) => {
    const contentItemId = Number(ctx.match![1]);
    await handleAdminContentDeleteConfirm(ctx, contentItemId);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_CONTENT_DELETE}(\\d+)$`), adminOnly, async (ctx) => {
    const contentItemId = Number(ctx.match![1]);
    await handleAdminContentDelete(ctx, contentItemId);
  });
  bot.callbackQuery(CB.ADMIN_CUSTOMERS, adminOnly, (ctx) =>
    handleAdminCustomers(ctx, 0)
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_CUSTOMERS_PAGE}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminCustomers(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_CUSTOMER_VIEW}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminCustomerView(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_CUSTOMER_PRODUCTS}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminCustomerProducts(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_CUSTOMER_ORDERS}(\\d+)(?::(\\d+))?$`),
    adminOnly,
    async (ctx) => {
      const telegramUserId = Number(ctx.match![1]);
      const page = ctx.match![2] ? Number(ctx.match![2]) : 0;
      await handleAdminCustomerOrders(ctx, telegramUserId, page);
    }
  );
  bot.callbackQuery(CB.ADMIN_SUPPORT, adminOnly, handleAdminSupportHub);
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_SUPPORT_LIST}(open|closed|all):(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminSupportList(ctx, ctx.match![1], Number(ctx.match![2]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_SUPPORT_VIEW}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminSupportView(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_SUPPORT_REPLY_CANCEL}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminSupportReplyCancel(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_SUPPORT_REPLY}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminSupportReplyStart(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_SUPPORT_CLOSE_OK}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminSupportCloseConfirm(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(
    new RegExp(`^${CB.ADMIN_SUPPORT_CLOSE}(\\d+)$`),
    adminOnly,
    async (ctx) => {
      await handleAdminSupportCloseAsk(ctx, Number(ctx.match![1]));
    }
  );
  bot.callbackQuery(CB.ADMIN_BACKUP, adminOnly, (ctx) =>
    handleAdminBackup(ctx, config)
  );
  bot.callbackQuery(CB.ADMIN_STATS, adminOnly, handleAdminStats);
  bot.callbackQuery(CB.ADMIN_PROMO, adminOnly, handleAdminPromoMenu);
  bot.callbackQuery(CB.ADMIN_PROMO_NEW, adminOnly, handleAdminPromoNew);
  bot.callbackQuery(CB.ADMIN_PROMO_CANCEL, adminOnly, handleAdminPromoCancel);
  bot.callbackQuery(CB.ADMIN_PROMO_TYPE_PERCENT, adminOnly, (ctx) =>
    handleAdminPromoType(ctx, "percent")
  );
  bot.callbackQuery(CB.ADMIN_PROMO_TYPE_FIXED, adminOnly, (ctx) =>
    handleAdminPromoType(ctx, "fixed")
  );
  bot.callbackQuery(CB.ADMIN_PROMO_NO_EXPIRY, adminOnly, handleAdminPromoNoExpiry);
  bot.callbackQuery(CB.ADMIN_PROMO_UNLIMITED, adminOnly, handleAdminPromoUnlimited);
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_PROMO_LIST}(\\d+)$`), adminOnly, async (ctx) => {
    await handleAdminPromoList(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_PROMO_VIEW}(\\d+)$`), adminOnly, async (ctx) => {
    await handleAdminPromoView(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_PROMO_OFF}(\\d+)$`), adminOnly, async (ctx) => {
    await handleAdminPromoSetActive(ctx, Number(ctx.match![1]), false);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_PROMO_ON}(\\d+)$`), adminOnly, async (ctx) => {
    await handleAdminPromoSetActive(ctx, Number(ctx.match![1]), true);
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_PROMO_DEL_OK}(\\d+)$`), adminOnly, async (ctx) => {
    await handleAdminPromoDeleteConfirm(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(new RegExp(`^${CB.ADMIN_PROMO_DEL}(\\d+)$`), adminOnly, async (ctx) => {
    await handleAdminPromoDeleteAsk(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(CB.ADMIN_INVITES, adminOnly, (ctx) =>
    handleAdminInvites(ctx, inviteLinkService)
  );
  bot.callbackQuery(CB.ADMIN_SETTINGS, adminOnly, (ctx) =>
    handleAdminSettings(ctx, config, inviteLinkService)
  );
  bot.callbackQuery(CB.ADMIN_SET_CHANNEL, adminOnly, (ctx) =>
    handleAdminSettingsChannel(ctx, config)
  );
  bot.callbackQuery(CB.ADMIN_SET_CONTACT, adminOnly, (ctx) =>
    handleAdminSettingsContact(ctx, config)
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY, adminOnly, (ctx) =>
    handleAdminSettingsPayment(ctx, config)
  );
  bot.callbackQuery(CB.ADMIN_SET_ADMIN, adminOnly, (ctx) =>
    handleAdminSettingsAdmin(ctx, config)
  );
  bot.callbackQuery(CB.ADMIN_SET_ADMIN_USER, adminOnly, (ctx) =>
    handleAdminSettingsStartEdit(ctx, "admin_username")
  );
  bot.callbackQuery(CB.ADMIN_SET_ADMIN_USER_DEL, adminOnly, (ctx) =>
    handleAdminSettingsDeleteAdminUsername(ctx, config)
  );
  bot.callbackQuery(CB.ADMIN_SET_CH_EDIT, adminOnly, (ctx) =>
    handleAdminSettingsStartEdit(ctx, "channel_id")
  );
  bot.callbackQuery(CB.ADMIN_SET_CT_EDIT, adminOnly, (ctx) =>
    handleAdminSettingsStartEdit(ctx, "contact_username")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_CCP, adminOnly, (ctx) =>
    handleAdminSettingsStartEdit(ctx, "ccp_account_info")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_RIP, adminOnly, (ctx) =>
    handleAdminSettingsStartEdit(ctx, "baridimob_rip")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_NAME, adminOnly, (ctx) =>
    handleAdminSettingsStartEdit(ctx, "payment_account_name")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_RDP, adminOnly, (ctx) =>
    handleAdminSettingsStartEdit(ctx, "redotpay_payment_info")
  );
  bot.callbackQuery(CB.ADMIN_SET_CH_ON, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.CHANNEL_ENABLED, true, "channel")
  );
  bot.callbackQuery(CB.ADMIN_SET_CH_OFF, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.CHANNEL_ENABLED, false, "channel")
  );
  bot.callbackQuery(CB.ADMIN_SET_CT_ON, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.CONTACT_ENABLED, true, "contact")
  );
  bot.callbackQuery(CB.ADMIN_SET_CT_OFF, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.CONTACT_ENABLED, false, "contact")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_CCP_ON, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.CCP_ENABLED, true, "payment")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_CCP_OFF, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.CCP_ENABLED, false, "payment")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_RDP_ON, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.REDOTPAY_ENABLED, true, "payment")
  );
  bot.callbackQuery(CB.ADMIN_SET_PAY_RDP_OFF, adminOnly, (ctx) =>
    handleAdminSettingsToggle(ctx, config, SETTINGS_KEYS.REDOTPAY_ENABLED, false, "payment")
  );
  bot.callbackQuery(CB.ADMIN_SET_CANCEL, adminOnly, (ctx) =>
    handleAdminSettingsCancel(ctx, config, inviteLinkService)
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

  bot.on("message", async (ctx, next) => {
    if (isAdmin(ctx, config.adminTelegramId)) {
      const handledAdminReply = await handleAdminSupportReplyInput(ctx);
      if (handledAdminReply) {
        return;
      }
    }

    const handledSupport = await handleSupportTicketInput(ctx, config);
    if (handledSupport) {
      return;
    }

    const handledProof = await handleCustomerPaymentProof(ctx, config);
    if (handledProof) {
      return;
    }

    const handledCheckoutPromo = await handleCheckoutPromoInput(ctx);
    if (handledCheckoutPromo) {
      return;
    }

    if (isAdmin(ctx, config.adminTelegramId)) {
      const handledUpload = await handleAdminContentUpload(ctx);
      if (handledUpload) {
        return;
      }

      const handledPromo = await handleAdminPromoInput(ctx);
      if (handledPromo) {
        return;
      }

      const handledSettings = await handleAdminSettingsInput(ctx, config);
      if (handledSettings) {
        return;
      }
    }

    await next();
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
