import fs from "fs";
import os from "os";
import path from "path";
import { getDatabase, getDatabasePath } from "./db";
import { logger } from "../utils/logger";

const ALGIERS_TZ = "Africa/Algiers";
const BACKUP_NAME_PREFIX = "3M-Kids-Zone-backup-";

let backupInProgress = false;

export interface SqliteBackupFile {
  filePath: string;
  fileName: string;
  createdAtLabel: string;
}

export function tryBeginBackup(): boolean {
  if (backupInProgress) {
    return false;
  }
  backupInProgress = true;
  return true;
}

export function endBackup(): void {
  backupInProgress = false;
}

function algiersBackupStamp(now = new Date()): { file: string; label: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ALGIERS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour").padStart(2, "0");
  const minute = value("minute").padStart(2, "0");

  const label = new Intl.DateTimeFormat("ar-DZ", {
    timeZone: ALGIERS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return {
    file: `${year}-${month}-${day}-${hour}${minute}`,
    label,
  };
}

function quoteSqlitePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return `'${normalized.replace(/'/g, "''")}'`;
}

function isSafeBackupPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const liveDb = path.resolve(getDatabasePath());
  if (resolved === liveDb) {
    return false;
  }

  const fileName = path.basename(resolved);
  if (!fileName.startsWith(BACKUP_NAME_PREFIX) || !fileName.endsWith(".db")) {
    return false;
  }

  return path.resolve(path.dirname(resolved)) === path.resolve(os.tmpdir());
}

export function deleteBackupFile(filePath: string): void {
  if (!isSafeBackupPath(filePath)) {
    logger.error("Refusing to delete a file that is not a temp backup");
    return;
  }

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.error("Failed to delete temporary backup file", error);
  }
}

export function createSqliteBackup(now = new Date()): SqliteBackupFile {
  const stamp = algiersBackupStamp(now);
  const fileName = `${BACKUP_NAME_PREFIX}${stamp.file}.db`;
  const filePath = path.join(os.tmpdir(), fileName);

  if (!isSafeBackupPath(filePath)) {
    throw new Error("Invalid backup destination");
  }

  if (fs.existsSync(filePath)) {
    deleteBackupFile(filePath);
  }

  try {
    const db = getDatabase();
    db.exec(`VACUUM INTO ${quoteSqlitePath(filePath)}`);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).size <= 0) {
      throw new Error("Backup file was not created");
    }

    return {
      filePath,
      fileName,
      createdAtLabel: stamp.label,
    };
  } catch (error) {
    deleteBackupFile(filePath);
    throw error;
  }
}
