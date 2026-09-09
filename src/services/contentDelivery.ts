import type { Api } from "grammy";
import type { ProductContentItem } from "../database/contentTypes";
import { userHasVideoAccess } from "./contentAccess";

const PROTECTED_CONTENT = { protect_content: true } as const;

export async function deliverOwnedContentItem(
  api: Api,
  chatId: number,
  telegramUserId: number,
  item: ProductContentItem
): Promise<"ok" | "denied"> {
  if (!userHasVideoAccess(telegramUserId, item.id)) {
    return "denied";
  }

  await deliverContentItem(api, chatId, item);
  return "ok";
}

export async function deliverContentItem(
  api: Api,
  chatId: number,
  item: ProductContentItem
): Promise<void> {
  const caption = item.descriptionAr
    ? `${item.titleAr}\n\n${item.descriptionAr}`
    : item.titleAr;

  switch (item.mediaKind) {
    case "video":
      await api.sendVideo(chatId, item.telegramFileId, {
        caption,
        ...PROTECTED_CONTENT,
      });
      return;
    case "photo":
      await api.sendPhoto(chatId, item.telegramFileId, {
        caption,
        ...PROTECTED_CONTENT,
      });
      return;
    case "animation":
      await api.sendAnimation(chatId, item.telegramFileId, {
        caption,
        ...PROTECTED_CONTENT,
      });
      return;
    case "document":
    default:
      await api.sendDocument(chatId, item.telegramFileId, {
        caption,
        ...PROTECTED_CONTENT,
      });
  }
}
