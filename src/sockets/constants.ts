import { BOOKING_REQUEST_EXPIRY_MS } from '../utils/bookingHelpers';

export { BOOKING_REQUEST_EXPIRY_MS };

/** Server → client */
export const SOCKET_EVENTS = {
  REQUEST_NEW: 'booking:request:new',
  REQUEST_UPDATED: 'booking:request:updated',
  REQUEST_EXPIRED: 'booking:request:expired',
  REQUESTS_COUNT: 'booking:requests:count',
  /** Client requested extra hours — open extension bottom sheet (companion: accept/deny, client: waiting). */
  EXTENSION_REQUESTED: 'booking:extension:requested',
  /** Companion accepted/denied extension — update or close bottom sheet on both sides. */
  EXTENSION_UPDATED: 'booking:extension:updated',
  /** Cron: remind client to open extension UI before meeting start (30 or 15 min). */
  EXTENSION_PROMPT: 'booking:extension:prompt',
  /** New predefined booking chat message in room booking:{id} */
  MESSAGE_NEW: 'booking:message:new',
  /** Session started — client should disable messaging UI */
  MESSAGING_CLOSED: 'booking:messaging:closed',
} as const;

/** Values for booking:extension:prompt payload.promptType */
export const EXTENSION_PROMPT_TYPES = {
  BEFORE_START_30_MIN: '30_MIN_BEFORE_START',
  BEFORE_START_15_MIN: '15_MIN_BEFORE_START',
} as const;

/** Client → server */
export const SOCKET_CLIENT_EVENTS = {
  BOOKING_SUBSCRIBE: 'booking:subscribe',
  BOOKING_UNSUBSCRIBE: 'booking:unsubscribe',
} as const;
