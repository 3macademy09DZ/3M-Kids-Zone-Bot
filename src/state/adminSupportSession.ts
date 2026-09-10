export interface AdminSupportReplySession {
  ticketId: number;
}

const sessions = new Map<number, AdminSupportReplySession>();

export function setAdminSupportReplySession(
  adminId: number,
  session: AdminSupportReplySession
): void {
  sessions.set(adminId, session);
}

export function getAdminSupportReplySession(
  adminId: number
): AdminSupportReplySession | undefined {
  return sessions.get(adminId);
}

export function clearAdminSupportReplySession(adminId: number): void {
  sessions.delete(adminId);
}
