import cron from 'node-cron';
import prisma from '../config/db';
import { BOOKING_REQUEST_EXPIRY_MS } from '../utils/bookingHelpers';
import { calculateJSS } from '../utils/jssCalculator';
import {
  emitBookingExtensionPrompt,
  emitBookingRequestExpired,
  emitBookingRequestUpdated,
} from '../sockets';
import { EXTENSION_PROMPT_TYPES } from '../sockets/constants';
import type { ExtensionPromptType } from '../sockets/bookingEmit';
import { sendPushNotification } from '../utils/notification';
import {
  bookingNotifData,
  formatBookingSchedule,
  personName,
} from '../utils/bookingNotifications';
import { refreshAllActiveHomeBars } from './homeBar';
import { emitBookingCoordinationClosed, refreshHomeBarForBooking } from '../sockets/bookingEmit';
import { runCoordinationCronTasks } from './coordination';

/** Match bookings whose startTime is ~N minutes from now (1-minute cron tick). */
const CRON_MATCH_WINDOW_MS = 60 * 1000;

function startTimeWindowMinutesBefore(minutesBeforeStart: number, nowMs = Date.now()) {
  const offsetMs = minutesBeforeStart * 60 * 1000;
  const half = CRON_MATCH_WINDOW_MS / 2;
  return {
    gte: new Date(nowMs + offsetMs - half),
    lte: new Date(nowMs + offsetMs + half),
  };
}

async function processExtensionPromptBeforeStart(
  minutesBefore: 30 | 15,
  promptType: ExtensionPromptType,
  sentField: 'extensionPrompt30SentAt' | 'extensionPrompt15SentAt'
) {
  const startTime = startTimeWindowMinutesBefore(minutesBefore);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'ACCEPTED',
      paymentStatus: 'PAID',
      startTime,
      [sentField]: null,
      extensionStatus: { not: 'PENDING' },
    },
    select: {
      id: true,
      clientId: true,
      startTime: true,
      endTime: true,
      companion: { select: { user: { select: { username: true } } } },
    },
  });

  if (bookings.length === 0) {
    return;
  }

  const title =
    minutesBefore === 30
      ? 'Meeting starts in 30 minutes'
      : 'Meeting starts in 15 minutes';
  const notifType = minutesBefore === 30 ? 'EXTENSION_PROMPT_30' : 'EXTENSION_PROMPT_15';

  for (const booking of bookings) {
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, [sentField]: null },
      data: { [sentField]: new Date() },
    });
    if (claimed.count === 0) {
      continue;
    }

    const companionName = personName(booking.companion.user?.username);
    const when = formatBookingSchedule(booking.startTime, booking.endTime);
    const body = `Your booking with ${companionName} starts soon (${when}). Need more time? Tap to request an extension.`;

    sendPushNotification(
      booking.clientId,
      title,
      body,
      bookingNotifData(booking.id, {
        promptType,
        action: 'SHOW_EXTENSION_SHEET',
        type: notifType,
        fromUsername: companionName,
      }),
      notifType
    ).catch((err) =>
      console.error(`[CRON] extension ${minutesBefore}m push:`, err)
    );

    emitBookingExtensionPrompt(booking.id, promptType).catch((err) =>
      console.error(`[CRON] extension ${minutesBefore}m socket:`, err)
    );
  }

  console.log(
    `[CRON] Extension prompt (${minutesBefore} min before start): ${bookings.length} booking(s).`
  );
}

async function sendScheduledExtensionPrompts() {
  await processExtensionPromptBeforeStart(
    30,
    EXTENSION_PROMPT_TYPES.BEFORE_START_30_MIN,
    'extensionPrompt30SentAt'
  );
  await processExtensionPromptBeforeStart(
    15,
    EXTENSION_PROMPT_TYPES.BEFORE_START_15_MIN,
    'extensionPrompt15SentAt'
  );
}

async function expireStalePendingRequests() {
  const cutoff = new Date(Date.now() - BOOKING_REQUEST_EXPIRY_MS);

  const stale = await prisma.booking.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      clientId: true,
      companionId: true,
      startTime: true,
      endTime: true,
      client: { select: { username: true } },
      companion: { select: { userId: true, user: { select: { username: true } } } },
    },
  });

  if (stale.length === 0) {
    return;
  }

  await prisma.booking.updateMany({
    where: { id: { in: stale.map((b) => b.id) } },
    data: {
      status: 'CANCELLED',
      cancellationReason: 'Automatically cancelled after 30 minutes of no response.',
    },
  });

  console.log(`[CRON] Automatically expired ${stale.length} booking requests.`);

  for (const booking of stale) {
    emitBookingRequestExpired(booking.id, booking.companionId, booking.clientId).catch((err) =>
      console.error('[CRON] Socket emit expired:', err)
    );

    const when = formatBookingSchedule(booking.startTime, booking.endTime);
    const clientName = personName(booking.client.username);
    const companionName = personName(booking.companion.user?.username);
    const data = bookingNotifData(booking.id, {
      status: 'CANCELLED',
      type: 'BOOKING_EXPIRED',
    });

    sendPushNotification(
      booking.clientId,
      'Booking Request Expired',
      `Your booking request with ${companionName} for ${when} expired — no response within 30 minutes. Booking #${booking.id}.`,
      { ...data, fromUsername: companionName },
      'BOOKING_EXPIRED'
    ).catch((err) => console.error('[CRON] expired push (client):', err));

    if (booking.companion.userId) {
      sendPushNotification(
        booking.companion.userId,
        'Booking Request Expired',
        `Booking request from ${clientName} for ${when} expired — no response within 30 minutes. Booking #${booking.id}.`,
        { ...data, fromUsername: clientName },
        'BOOKING_EXPIRED'
      ).catch((err) => console.error('[CRON] expired push (companion):', err));
    }
  }
}

async function autoCompleteActiveBookingsPastEndTime() {
  const now = new Date();

  const due = await prisma.booking.findMany({
    where: {
      status: 'ACTIVE',
      endTime: { lte: now },
    },
    select: {
      id: true,
      companionId: true,
    },
  });

  if (due.length === 0) {
    return;
  }

  for (const booking of due) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'COMPLETED' },
    });

    calculateJSS(booking.companionId).catch((err) =>
      console.error(`[CRON] JSS calculation failed for companion ${booking.companionId}:`, err)
    );

    emitBookingRequestUpdated(booking.id).catch((err) =>
      console.error('[CRON] Socket emit completed:', err)
    );
    emitBookingCoordinationClosed(
      booking.id,
      'This booking has ended.'
    ).catch((err) => console.error('[CRON] coordination closed:', err));
    refreshHomeBarForBooking(booking.id).catch((err) =>
      console.error('[CRON] refreshHomeBarForBooking:', err)
    );
  }

  console.log(`[CRON] Automatically completed ${due.length} active booking(s).`);
}

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    await expireStalePendingRequests();
  } catch (error) {
    console.error('[CRON] Error expiring bookings:', error);
  }

  try {
    await autoCompleteActiveBookingsPastEndTime();
  } catch (error) {
    console.error('[CRON] Error auto-completing bookings:', error);
  }

  try {
    await sendScheduledExtensionPrompts();
  } catch (error) {
    console.error('[CRON] Error sending extension prompts:', error);
  }

  try {
    await refreshAllActiveHomeBars();
  } catch (error) {
    console.error('[CRON] Error refreshing home booking bars:', error);
  }

  try {
    await runCoordinationCronTasks();
  } catch (error) {
    console.error('[CRON] Error running coordination tasks:', error);
  }
});
