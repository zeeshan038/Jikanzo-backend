import prisma from '../config/db';
import { HOME_BAR_LEAD_MS } from '../utils/bookingHomeBar';
import { emitHomeBarToUser } from '../sockets/bookingEmit';

/** Re-emit home bar for users with an upcoming / in-session booking (1-min cron). */
export async function refreshAllActiveHomeBars() {
  const now = new Date();
  const latestStart = new Date(now.getTime() + HOME_BAR_LEAD_MS);

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      startTime: { lte: latestStart },
      endTime: { gt: now },
    },
    select: {
      clientId: true,
      companion: { select: { userId: true } },
    },
  });

  const userIds = new Set<number>();
  for (const b of bookings) {
    userIds.add(b.clientId);
    if (b.companion.userId) userIds.add(b.companion.userId);
  }

  for (const userId of userIds) {
    await emitHomeBarToUser(userId);
  }
}
