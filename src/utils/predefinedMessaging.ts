import type { Booking } from '@prisma/client';
import {
  CATALOG_VERSION,
  MESSAGE_BY_ID,
  PREDEFINED_MESSAGES,
  QUICK_REPLIES_BY_MESSAGE_ID,
  type BookingMessageKind,
  type PredefinedMessage,
} from './predefinedMessageCatalog';
import { normalizeSearchInput } from './predefinedMessageNormalize';

export {
  CATALOG_VERSION,
  PREDEFINED_MESSAGES,
  QUICK_REPLIES_BY_MESSAGE_ID,
  type BookingMessageKind,
  type PredefinedMessage,
};

const MAX_SUGGESTIONS = 4;
const MAIN_PRIORITY_BONUS = 5;

function scoreMessage(message: PredefinedMessage, query: string): number {
  if (!query) return 0;

  let best = 0;
  for (const alias of message.aliases) {
    if (alias === query) best = Math.max(best, 100);
    else if (alias.startsWith(query)) best = Math.max(best, 80);
    else if (query.startsWith(alias) && alias.length >= 3) best = Math.max(best, 70);
    else if (alias.includes(query)) best = Math.max(best, 60);
    else if (query.includes(alias) && alias.length >= 4) best = Math.max(best, 50);
  }

  if (message.type === 'main') {
    best += MAIN_PRIORITY_BONUS;
  }

  return best;
}

export function searchPredefinedMessages(rawQuery: string): PredefinedMessage[] {
  const query = normalizeSearchInput(rawQuery);
  if (!query) return [];

  const scored = PREDEFINED_MESSAGES.map((message) => ({
    message,
    score: scoreMessage(message, query),
  }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.message.text.localeCompare(b.message.text));

  const seen = new Set<string>();
  const results: PredefinedMessage[] = [];
  for (const row of scored) {
    if (seen.has(row.message.id)) continue;
    seen.add(row.message.id);
    results.push(row.message);
    if (results.length >= MAX_SUGGESTIONS) break;
  }

  return results;
}

export function getMessageById(messageId: string): PredefinedMessage | undefined {
  return MESSAGE_BY_ID.get(messageId);
}

export function getQuickRepliesForMessageId(messageId: string): PredefinedMessage[] {
  const ids = QUICK_REPLIES_BY_MESSAGE_ID[messageId] ?? [];
  return ids
    .map((id) => MESSAGE_BY_ID.get(id))
    .filter((m): m is PredefinedMessage => m != null);
}

export function isBookingMessagingAvailable(
  booking: Pick<Booking, 'status' | 'paymentStatus'>
): boolean {
  return booking.status === 'ACCEPTED' && booking.paymentStatus === 'PAID';
}

export function messagingUnavailableReason(
  booking: Pick<Booking, 'status' | 'paymentStatus'>
): string | null {
  if (isBookingMessagingAvailable(booking)) return null;
  if (booking.status === 'ACTIVE' || booking.status === 'COMPLETED') {
    return 'Booking messages are unavailable after the session starts.';
  }
  if (booking.status === 'CANCELLED') {
    return 'This booking was cancelled.';
  }
  if (booking.status !== 'ACCEPTED') {
    return 'Messaging is available after the companion accepts the booking.';
  }
  if (booking.paymentStatus !== 'PAID') {
    return 'Messaging is available after payment is completed.';
  }
  return 'Messaging is not available for this booking.';
}
