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
} as const;

/** Client → server */
export const SOCKET_CLIENT_EVENTS = {
  BOOKING_SUBSCRIBE: 'booking:subscribe',
  BOOKING_UNSUBSCRIBE: 'booking:unsubscribe',
} as const;
