import { config as loadEnv } from "dotenv";

loadEnv();

export interface EnvConfig {
  botToken: string;
  adminTelegramId: number;
  channelId: string | undefined;
  contactUsername: string | undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseAdminId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("ADMIN_TELEGRAM_ID must be a positive integer");
  }
  return id;
}

export function loadConfig(): EnvConfig {
  const botToken = requireEnv("BOT_TOKEN");
  const adminTelegramId = parseAdminId(requireEnv("ADMIN_TELEGRAM_ID"));

  const channelId = process.env.CHANNEL_ID?.trim() || undefined;
  const contactUsername = process.env.CONTACT_USERNAME?.trim() || undefined;

  return {
    botToken,
    adminTelegramId,
    channelId,
    contactUsername,
  };
}

export function isChannelConfigured(channelId: string | undefined): boolean {
  return Boolean(channelId && channelId.length > 0);
}

export function formatContactLink(username: string | undefined): string | null {
  if (!username) return null;
  const clean = username.replace(/^@/, "");
  return `https://t.me/${clean}`;
}
