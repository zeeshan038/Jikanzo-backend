/** Default / floor shown as "Starting at $85/hr" when companion has not set a rate. */
export const DEFAULT_COMPANION_HOURLY_RATE = 85;

/**
 * Use stored rate when companion set one; otherwise $85.
 * Treats null / undefined / 0 as "not set".
 */
export function resolveCompanionHourlyRate(
  hourlyRate: number | null | undefined
): number {
  if (hourlyRate == null || hourlyRate <= 0) {
    return DEFAULT_COMPANION_HOURLY_RATE;
  }
  return hourlyRate;
}
