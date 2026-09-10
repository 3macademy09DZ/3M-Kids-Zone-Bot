export type AdminSettingsEditField =
  | "channel_id"
  | "contact_username"
  | "ccp_account_info"
  | "baridimob_rip"
  | "payment_account_name"
  | "redotpay_payment_info";

export interface AdminSettingsSession {
  field: AdminSettingsEditField;
}

const sessions = new Map<number, AdminSettingsSession>();

export function setAdminSettingsSession(
  adminId: number,
  session: AdminSettingsSession
): void {
  sessions.set(adminId, session);
}

export function getAdminSettingsSession(
  adminId: number
): AdminSettingsSession | undefined {
  return sessions.get(adminId);
}

export function clearAdminSettingsSession(adminId: number): void {
  sessions.delete(adminId);
}
