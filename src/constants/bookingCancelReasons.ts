export const BOOKING_CANCEL_REASONS = [
  { code: 'CHANGE_OF_PLANS', label: 'Change of plans' },
  { code: 'COMPANION_NOT_ARRIVING', label: 'Companion is not arriving' },
  { code: 'CLIENT_NOT_AVAILABLE', label: 'Client not available' },
  { code: 'WRONG_LOCATION', label: 'Wrong location or address issue' },
  { code: 'SCHEDULE_CONFLICT', label: 'Schedule conflict' },
  { code: 'FOUND_ANOTHER_COMPANION', label: 'Found another companion' },
  { code: 'OTHER', label: 'Other' },
] as const;

export type BookingCancelReasonCode = (typeof BOOKING_CANCEL_REASONS)[number]['code'];

export const isValidCancelReasonCode = (code: string): code is BookingCancelReasonCode =>
  BOOKING_CANCEL_REASONS.some((r) => r.code === code);
