import prisma from '../config/db';
import { emitTodayCardsToUser } from '../sockets/bookingEmit';

/**
 * Re-emit companion today-cards every minute so STARTS_IN → ENTER_OTP
 * (and ENDS_IN countdown freshness) flips without a client refetch.
 */
export async function refreshAllCompanionTodayCards() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['ACCEPTED', 'ACTIVE', 'COMPLETED'] },
      startTime: { gte: start, lt: end },
    },
    select: {
      companion: { select: { userId: true } },
    },
  });

  const companionUserIds = new Set<number>();
  for (const b of bookings) {
    if (b.companion.userId) companionUserIds.add(b.companion.userId);
  }

  for (const userId of companionUserIds) {
    await emitTodayCardsToUser(userId);
  }
}
