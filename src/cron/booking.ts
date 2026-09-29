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
    select: { id: true, clientId: true },
  });

  if (bookings.length === 0) {
    return;
  }

  const title =
    minutesBefore === 30
      ? 'Meeting starts in 30 minutes'
      : 'Meeting starts in 15 minutes';
  const body = 'Need more time together? Tap to request a session extension.';
  const notifType = minutesBefore === 30 ? 'EXTENSION_PROMPT_30' : 'EXTENSION_PROMPT_15';

  for (const booking of bookings) {
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, [sentField]: null },
      data: { [sentField]: new Date() },
    });
    if (claimed.count === 0) {
      continue;
    }

    sendPushNotification(booking.clientId, title, body, {
      bookingId: String(booking.id),
      promptType,
      action: 'SHOW_EXTENSION_SHEET',
    }, notifType).catch((err) =>
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
});
