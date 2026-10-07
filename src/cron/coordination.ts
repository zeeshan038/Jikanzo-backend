import prisma from '../config/db';
import { HOME_BAR_LEAD_MS } from '../utils/bookingHomeBar';
import { expireStaleRingingCalls } from '../utils/bookingCallService';
import {
  emitBookingCoordinationClosed,
  emitBookingCoordinationOpened,
} from '../sockets/bookingEmit';

const CRON_MATCH_WINDOW_MS = 60 * 1000;

function startTimeWindowMinutesBefore(minutesBeforeStart: number, nowMs = Date.now()) {
  const offsetMs = minutesBeforeStart * 60 * 1000;
  const half = CRON_MATCH_WINDOW_MS / 2;
  return {
    gte: new Date(nowMs + offsetMs - half),
    lte: new Date(nowMs + offsetMs + half),
  };
}

export async function runCoordinationCronTasks() {
  await expireStaleRingingCalls();

  const leadMinutes = HOME_BAR_LEAD_MS / 60_000;
  const startTime = startTimeWindowMinutesBefore(leadMinutes);

  const opening = await prisma.booking.findMany({
    where: {
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      startTime,
      coordinationOpenNotifiedAt: null,
    },
    select: { id: true },
  });

  for (const booking of opening) {
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, coordinationOpenNotifiedAt: null },
      data: { coordinationOpenNotifiedAt: new Date() },
    });
    if (claimed.count === 0) continue;
    await emitBookingCoordinationOpened(booking.id);
  }

  const now = new Date();
  const pastEnd = await prisma.booking.findMany({
    where: {
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      endTime: { lte: now },
    },
    select: { id: true },
  });

  for (const booking of pastEnd) {
    await emitBookingCoordinationClosed(
      booking.id,
      'The coordination window for this booking has ended.'
    );
  }
}
