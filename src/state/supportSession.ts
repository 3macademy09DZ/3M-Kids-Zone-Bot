export interface SupportSession {
  awaitingMessage: true;
  ticketId?: number;
}

const sessions = new Map<number, SupportSession>();

export function setSupportSession(
  userId: number,
  session: SupportSession
): void {
  sessions.set(userId, session);
}

export function getSupportSession(
  userId: number
): SupportSession | undefined {
  return sessions.get(userId);
}

export function clearSupportSession(userId: number): void {
  sessions.delete(userId);
}
