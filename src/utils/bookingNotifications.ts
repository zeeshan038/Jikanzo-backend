/** Shared copy helpers for detailed booking push notifications. */

export function personName(username?: string | null): string {
  const name = username?.trim();
  return name || 'Someone';
}

export function formatBookingSchedule(start: Date, end?: Date | null): string {
  const date = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const startLabel = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  if (!end) {
    return `${date} at ${startLabel}`;
  }
  const endLabel = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${date}, ${startLabel} – ${endLabel}`;
}

export function bookingNotifData(
  bookingId: number,
  extra: Record<string, unknown> = {}
): Record<string, string> {
  const data: Record<string, string> = {
    bookingId: String(bookingId),
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value == null) continue;
    data[key] = typeof value === 'string' ? value : String(value);
  }
  return data;
}
