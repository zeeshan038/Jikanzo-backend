import type { Socket } from 'socket.io';
import prisma from '../config/db';
import { SOCKET_CLIENT_EVENTS } from './constants';
import { emitBookingCallSignal } from './bookingEmit';
import { assertCallParticipant } from '../utils/bookingCallService';
import { isBookingCoordinationOpen } from '../utils/bookingCoordination';

type SignalPayload = {
  bookingId?: number;
  callId?: string;
  signalType?: string;
  sdp?: string;
  candidate?: unknown;
};

const ALLOWED_SIGNAL_TYPES = new Set(['offer', 'answer', 'ice']);

export function registerBookingCallHandlers(socket: Socket) {
  const userId = socket.data.userId as number;
  const companionProfileId = socket.data.companionProfileId as number | undefined;

  socket.on(SOCKET_CLIENT_EVENTS.CALL_SIGNAL, async (raw: SignalPayload) => {
    const bookingId = Number(raw?.bookingId);
    const callId = typeof raw?.callId === 'string' ? raw.callId : '';
    const signalType = typeof raw?.signalType === 'string' ? raw.signalType.toLowerCase() : '';

    if (!Number.isFinite(bookingId) || !callId || !ALLOWED_SIGNAL_TYPES.has(signalType)) {
      return;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { clientId: true, companionId: true, status: true, startTime: true, endTime: true },
    });
    if (!booking) return;

    const isClient = booking.clientId === userId;
    const isCompanion =
      companionProfileId != null && booking.companionId === companionProfileId;
    if (!isClient && !isCompanion) return;

    if (!isBookingCoordinationOpen(booking)) {
      return;
    }

    const access = await assertCallParticipant(callId, userId);
    if (!access.ok) return;

    const call = access.call;
    if (call.bookingId !== bookingId) return;
    if (call.status !== 'RINGING' && call.status !== 'ACCEPTED') return;

    const peerUserId =
      call.callerUserId === userId ? call.receiverUserId : call.callerUserId;

    emitBookingCallSignal(bookingId, peerUserId, {
      callId,
      fromUserId: userId,
      signalType,
      sdp: typeof raw.sdp === 'string' ? raw.sdp : undefined,
      candidate: raw.candidate,
    });
  });
}
