export interface AppliedCheckoutPromo {
  code: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
}

export interface CheckoutSession {
  contentId: number;
  awaitingCode: boolean;
  applied?: AppliedCheckoutPromo;
}

const sessions = new Map<number, CheckoutSession>();

export function setCheckoutSession(
  userId: number,
  session: CheckoutSession
): void {
  sessions.set(userId, session);
}

export function getCheckoutSession(
  userId: number
): CheckoutSession | undefined {
  return sessions.get(userId);
}

export function clearCheckoutSession(userId: number): void {
  sessions.delete(userId);
}
