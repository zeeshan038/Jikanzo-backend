export const BOOKING_CALL_STATUSES = [
  'RINGING',
  'ACCEPTED',
  'REJECTED',
  'MISSED',
  'ENDED',
  'FAILED',
] as const;

export type BookingCallStatus = (typeof BOOKING_CALL_STATUSES)[number];

/** Ringing timeout before status → MISSED */
export const BOOKING_CALL_RING_TIMEOUT_MS = 45_000;

export const BOOKING_CALL_TERMINAL_STATUSES: BookingCallStatus[] = [
  'REJECTED',
  'MISSED',
  'ENDED',
  'FAILED',
];

export function isTerminalCallStatus(status: string): boolean {
  return (BOOKING_CALL_TERMINAL_STATUSES as readonly string[]).includes(status);
}
