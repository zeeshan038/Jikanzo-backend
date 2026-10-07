import { randomBytes } from 'crypto';
import prisma from '../config/db';
import {
  BOOKING_CALL_RING_TIMEOUT_MS,
  type BookingCallStatus,
  isTerminalCallStatus,
} from '../constants/bookingCalling';
import { isBookingCoordinationOpen } from './bookingCoordination';

type BookingWithCompanion = {
  id: number;
  clientId: number;
  companionId: number;
  status: string;
  startTime: Date;
  endTime: Date;
  companion: { userId: number };
};

export function serializeBookingCall(row: {
  id: string;
  bookingId: number;
  callerUserId: number;
  receiverUserId: number;
  roomName: string;
  status: string;
  startedAt: Date | null;
  answeredAt: Date | null;
  endedAt: Date | null;
  duration: number | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    callerUserId: row.callerUserId,
    receiverUserId: row.receiverUserId,
    roomName: row.roomName,
    status: row.status,
    startedAt: row.startedAt?.toISOString() ?? null,
    answeredAt: row.answeredAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    duration: row.duration,
    createdAt: row.createdAt.toISOString(),
  };
}

function newRoomName(bookingId: number): string {
  return `booking-${bookingId}-${randomBytes(8).toString('hex')}`;
}

function formatCallHistoryText(status: BookingCallStatus, durationSec: number | null): string {
  switch (status) {
    case 'ENDED':
      if (durationSec != null && durationSec > 0) {
        const m = Math.floor(durationSec / 60);
        const s = durationSec % 60;
        return m > 0 ? `Voice call · ${m}m ${s}s` : `Voice call · ${s}s`;
      }
      return 'Voice call · Cancelled';
    case 'MISSED':
      return 'Missed voice call';
    case 'REJECTED':
      return 'Voice call declined';
    case 'FAILED':
      return 'Voice call failed';
    default:
      return 'Voice call';
  }
}

export async function appendCallSystemMessage(
  bookingId: number,
  senderUserId: number,
  status: BookingCallStatus,
  durationSec: number | null
) {
  const row = await prisma.bookingMessage.create({
    data: {
      bookingId,
      senderUserId,
      kind: 'CALL',
      text: formatCallHistoryText(status, durationSec),
    },
  });

  const { emitBookingMessageNew } = await import('../sockets/bookingEmit');
  await emitBookingMessageNew(bookingId, {
    id: row.id,
    bookingId: row.bookingId,
    senderUserId: row.senderUserId,
    messageId: row.messageId,
    text: row.text,
    imageUrl: row.imageUrl,
    kind: row.kind,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.createdAt,
  });
}

export async function loadBookingForCall(bookingId: number): Promise<BookingWithCompanion | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      clientId: true,
      companionId: true,
      status: true,
      startTime: true,
      endTime: true,
      companion: { select: { userId: true } },
    },
  });
}

export function resolveOtherParticipantUserId(booking: BookingWithCompanion, callerUserId: number) {
  const companionUserId = booking.companion.userId;
  if (callerUserId === booking.clientId) {
    return companionUserId;
  }
  if (callerUserId === companionUserId) {
    return booking.clientId;
  }
  return null;
}

export async function expireStaleRingingCalls(now = new Date()) {
  const cutoff = new Date(now.getTime() - BOOKING_CALL_RING_TIMEOUT_MS);
  const stale = await prisma.bookingCall.findMany({
    where: {
      status: 'RINGING',
      createdAt: { lt: cutoff },
    },
  });

  const { emitBookingCallState } = await import('../sockets/bookingEmit');

  for (const call of stale) {
    const updated = await finalizeCall(call.id, 'MISSED', now);
    if (updated) {
      emitBookingCallState(updated.bookingId, serializeBookingCall(updated));
    }
  }

  return stale.length;
}

export async function finalizeCall(
  callId: string,
  status: BookingCallStatus,
  endedAt = new Date()
) {
  const existing = await prisma.bookingCall.findUnique({ where: { id: callId } });
  if (!existing || isTerminalCallStatus(existing.status)) {
    return existing;
  }

  let duration: number | null = null;
  if (status === 'ENDED' && existing.answeredAt) {
    duration = Math.max(0, Math.floor((endedAt.getTime() - existing.answeredAt.getTime()) / 1000));
  }

  const updated = await prisma.bookingCall.update({
    where: { id: callId },
    data: {
      status,
      endedAt,
      duration: duration ?? existing.duration,
    },
  });

  await appendCallSystemMessage(
    updated.bookingId,
    updated.callerUserId,
    status,
    updated.duration
  );

  return updated;
}

export async function endActiveCallsForBooking(
  bookingId: number,
  finalStatus: BookingCallStatus = 'ENDED'
) {
  const active = await prisma.bookingCall.findMany({
    where: {
      bookingId,
      status: { in: ['RINGING', 'ACCEPTED'] },
    },
  });

  for (const call of active) {
    await finalizeCall(call.id, call.status === 'RINGING' ? 'MISSED' : finalStatus);
  }
}

export type CreateCallResult =
  | { ok: false; status: number; msg: string; code?: string }
  | { ok: true; call: ReturnType<typeof serializeBookingCall> };

export async function createBookingCall(
  bookingId: number,
  callerUserId: number
): Promise<CreateCallResult> {
  const booking = await loadBookingForCall(bookingId);
  if (!booking) {
    return { ok: false, status: 404, msg: 'Booking not found' };
  }

  const receiverUserId = resolveOtherParticipantUserId(booking, callerUserId);
  if (receiverUserId == null) {
    return { ok: false, status: 403, msg: 'Unauthorized to call on this booking' };
  }

  if (!isBookingCoordinationOpen(booking)) {
    return {
      ok: false,
      status: 403,
      msg: 'Voice calling is not available for this booking right now.',
      code: 'CALLING_CLOSED',
    };
  }

  const existingRinging = await prisma.bookingCall.findFirst({
    where: { bookingId, status: { in: ['RINGING', 'ACCEPTED'] } },
  });
  if (existingRinging) {
    return {
      ok: false,
      status: 409,
      msg: 'A call is already in progress for this booking.',
      code: 'CALL_IN_PROGRESS',
    };
  }

  const now = new Date();
  const call = await prisma.bookingCall.create({
    data: {
      bookingId,
      callerUserId,
      receiverUserId,
      roomName: newRoomName(bookingId),
      status: 'RINGING',
      startedAt: now,
    },
  });

  return { ok: true, call: serializeBookingCall(call) };
}

export async function getActiveCallForBooking(bookingId: number) {
  return prisma.bookingCall.findFirst({
    where: { bookingId, status: { in: ['RINGING', 'ACCEPTED'] } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function assertCallParticipant(
  callId: string,
  userId: number
): Promise<
  | { ok: false; status: number; msg: string }
  | { ok: true; call: NonNullable<Awaited<ReturnType<typeof prisma.bookingCall.findUnique>>> }
> {
  const call = await prisma.bookingCall.findUnique({ where: { id: callId } });
  if (!call) {
    return { ok: false, status: 404, msg: 'Call not found' };
  }
  if (call.callerUserId !== userId && call.receiverUserId !== userId) {
    return { ok: false, status: 403, msg: 'Unauthorized for this call' };
  }
  return { ok: true, call };
}
