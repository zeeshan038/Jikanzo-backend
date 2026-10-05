/** Instagram-style story lifetime for companion moments */
export const MOMENT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function momentExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + MOMENT_LIFETIME_MS);
}

export function isMomentActive(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt > now;
}

export function activeMomentsWhere(now: Date = new Date()) {
  return { expiresAt: { gt: now } };
}
