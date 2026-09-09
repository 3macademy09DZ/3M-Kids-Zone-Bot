export interface PaymentProofSession {
  orderId: number;
}

const sessions = new Map<number, PaymentProofSession>();

export function setPaymentProofSession(
  userId: number,
  session: PaymentProofSession
): void {
  sessions.set(userId, session);
}

export function getPaymentProofSession(
  userId: number
): PaymentProofSession | undefined {
  return sessions.get(userId);
}

export function clearPaymentProofSession(userId: number): void {
  sessions.delete(userId);
}
