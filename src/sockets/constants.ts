import { BOOKING_REQUEST_EXPIRY_MS } from '../utils/bookingHelpers';

export { BOOKING_REQUEST_EXPIRY_MS };

/** Server → client */
export const SOCKET_EVENTS = {
  REQUEST_NEW: 'booking:request:new',
  REQUEST_UPDATED: 'booking:request:updated',
  REQUEST_EXPIRED: 'booking:request:expired',
  REQUESTS_COUNT: 'booking:requests:count',
} as const;

/** Client → server */
export const SOCKET_CLIENT_EVENTS = {
  BOOKING_SUBSCRIBE: 'booking:subscribe',
  BOOKING_UNSUBSCRIBE: 'booking:unsubscribe',
} as const;
