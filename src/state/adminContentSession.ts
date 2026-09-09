import type { ContentType } from "../database/contentTypes";

export type AdminContentStep =
  | "awaiting_title"
  | "awaiting_media"
  | "awaiting_rename";

export interface AdminContentSession {
  productId: string;
  contentType: ContentType;
  step: AdminContentStep;
  titleAr?: string;
  contentItemId?: number;
}

const sessions = new Map<number, AdminContentSession>();

export function setAdminContentSession(
  adminId: number,
  session: AdminContentSession
): void {
  sessions.set(adminId, session);
}

export function getAdminContentSession(
  adminId: number
): AdminContentSession | undefined {
  return sessions.get(adminId);
}

export function clearAdminContentSession(adminId: number): void {
  sessions.delete(adminId);
}
