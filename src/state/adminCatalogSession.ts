export type AdminCatalogStep =
  | "awaiting_year_name"
  | "awaiting_year_rename"
  | "awaiting_subject_name"
  | "awaiting_subject_rename"
  | "awaiting_type_name"
  | "awaiting_type_emoji"
  | "awaiting_type_rename"
  | "awaiting_item_title"
  | "awaiting_item_price"
  | "awaiting_item_url"
  | "awaiting_item_rename"
  | "awaiting_item_price_edit"
  | "awaiting_item_url_edit";

export interface AdminCatalogSession {
  step: AdminCatalogStep;
  yearId?: number;
  subjectId?: number;
  catalogContentTypeId?: number;
  itemId?: number;
  titleAr?: string;
  price?: number;
  typeNameAr?: string;
  typeEmoji?: string;
}

const sessions = new Map<number, AdminCatalogSession>();

export function setAdminCatalogSession(
  adminId: number,
  session: AdminCatalogSession
): void {
  sessions.set(adminId, session);
}

export function getAdminCatalogSession(
  adminId: number
): AdminCatalogSession | undefined {
  return sessions.get(adminId);
}

export function clearAdminCatalogSession(adminId: number): void {
  sessions.delete(adminId);
}
