import { InputFile } from "grammy";
import type { Context } from "grammy";
import type { EnvConfig } from "../config/env";
import { adminBackKeyboard } from "../keyboards/menus";
import {
  createSqliteBackup,
  deleteBackupFile,
  endBackup,
  tryBeginBackup,
} from "../database/backup";
import { logger } from "../utils/logger";

async function notifyAdmin(
  ctx: Context,
  text: string
): Promise<void> {
  try {
    await ctx.reply(text, {
      reply_markup: adminBackKeyboard(),
    });
  } catch (error) {
    logger.error("Failed to notify admin about backup result", error);
  }
}

export async function handleAdminBackup(
  ctx: Context,
  config: EnvConfig
): Promise<void> {
  if (!tryBeginBackup()) {
    await ctx.answerCallbackQuery({
      text: "⏳ هناك نسخة احتياطية قيد التنفيذ حالياً. انتظر حتى تكتمل.",
      show_alert: true,
    });
    return;
  }

  let backupPath: string | null = null;

  try {
    await ctx.answerCallbackQuery({
      text: "💾 جاري إنشاء النسخة الاحتياطية...",
    });

    const backup = createSqliteBackup();
    backupPath = backup.filePath;

    await ctx.api.sendDocument(
      config.adminTelegramId,
      new InputFile(backup.filePath, backup.fileName),
      {
        caption:
          "💾 نسخة احتياطية لقاعدة بيانات 3M Kids Zone\n" +
          `📅 التاريخ: ${backup.createdAtLabel}\n` +
          "✅ تم إنشاء النسخة بنجاح",
      }
    );
  } catch (error) {
    logger.error("Database backup failed", error);
    await notifyAdmin(
      ctx,
      "❌ تعذّر إنشاء أو إرسال النسخة الاحتياطية.\n" +
        "قاعدة البيانات الأصلية لم تُمس."
    );
  } finally {
    if (backupPath) {
      deleteBackupFile(backupPath);
    }
    endBackup();
  }
}
