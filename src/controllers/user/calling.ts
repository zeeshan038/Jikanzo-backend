import { Request, Response } from 'express';
import prisma from '../../config/db';
import { buildCoordinationStatus } from '../../utils/bookingCoordination';
import {
  assertCallParticipant,
  createBookingCall,
  finalizeCall,
  getActiveCallForBooking,
  loadBookingForCall,
  serializeBookingCall,
} from '../../utils/bookingCallService';
import { buildIceServersForUser } from '../../utils/webrtcIce';
import {
  emitBookingCallIncoming,
  emitBookingCallState,
  isUserInBookingChatRoom,
} from '../../sockets/bookingEmit';
import { sendFcmPushOnly } from '../../utils/notification';
import { isBookingCoordinationOpen } from '../../utils/bookingCoordination';

async function assertBookingParticipant(bookingId: number, userId: number) {
  const booking = await loadBookingForCall(bookingId);
  if (!booking) {
    return { ok: false as const, status: 404, msg: 'Booking not found' };
  }
  const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });
  const isClient = booking.clientId === userId;
  const isCompanion =
    companionProfile != null && booking.companionId === companionProfile.id;
  if (!isClient && !isCompanion) {
    return { ok: false as const, status: 403, msg: 'Unauthorized to access this booking' };
  }
  return { ok: true as const, booking };
}

/**
 * @Description Voice calling availability (same window as booking chat)
 * @Route GET /api/calling/:id/status
 * @Access Private
 */
export const getCallingStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const access = await assertBookingParticipant(bookingId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const coordination = buildCoordinationStatus(access.booking);
  const activeCall = await getActiveCallForBooking(bookingId);

  res.status(200).json({
    status: true,
    data: {
      ...coordination,
      activeCall: activeCall ? serializeBookingCall(activeCall) : null,
    },
  });
};

/**
 * @Description WebRTC ICE servers and active call session info
 * @Route GET /api/calling/:id/config
 * @Access Private
 */
export const getCallingConfig = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const access = await assertBookingParticipant(bookingId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const activeCall = await getActiveCallForBooking(bookingId);

  res.status(200).json({
    status: true,
    data: {
      iceServers: buildIceServersForUser(userId),
      activeCall: activeCall ? serializeBookingCall(activeCall) : null,
    },
  });
};

/**
 * @Description List voice call history for a booking
 * @Route GET /api/calling/:id/history
 * @Access Private
 */
export const getCallHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const access = await assertBookingParticipant(bookingId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const calls = await prisma.bookingCall.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.status(200).json({
    status: true,
    data: { calls: calls.map(serializeBookingCall) },
  });
};

/**
 * @Description Start a voice call (ringing)
 * @Route POST /api/calling/:id/calls
 * @Access Private
 */
export const createCall = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const result = await createBookingCall(bookingId, userId);
  if (!result.ok) {
    res.status(result.status).json({
      status: false,
      msg: result.msg,
      code: result.code,
    });
    return;
  }

  const call = result.call;
  emitBookingCallIncoming(bookingId, call, call.receiverUserId);
  emitBookingCallState(bookingId, call);

  if (!isUserInBookingChatRoom(call.receiverUserId, bookingId)) {
    const caller = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    await sendFcmPushOnly(
      call.receiverUserId,
      caller?.username?.trim() || 'Incoming call',
      'Voice call for your booking',
      {
        type: 'BOOKING_CALL',
        bookingId: String(bookingId),
        callId: call.id,
      }
    );
  }

  res.status(201).json({
    status: true,
    data: {
      call,
      iceServers: buildIceServersForUser(userId),
    },
  });
};

/**
 * @Description Accept an incoming voice call
 * @Route POST /api/calling/:id/calls/:callId/accept
 * @Access Private
 */
export const acceptCall = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  const callId = req.params.callId;
  if (!Number.isFinite(bookingId) || !callId) {
    res.status(400).json({ status: false, msg: 'Invalid request' });
    return;
  }

  const access = await assertCallParticipant(callId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const call = access.call;
  if (call.bookingId !== bookingId) {
    res.status(400).json({ status: false, msg: 'Call does not belong to this booking' });
    return;
  }
  if (call.receiverUserId !== userId) {
    res.status(403).json({ status: false, msg: 'Only the receiver can accept this call' });
    return;
  }
  if (call.status !== 'RINGING') {
    res.status(400).json({ status: false, msg: 'Call is not ringing' });
    return;
  }

  const booking = await loadBookingForCall(bookingId);
  if (!booking || !isBookingCoordinationOpen(booking)) {
    res.status(403).json({ status: false, msg: 'Calling is closed for this booking', code: 'CALLING_CLOSED' });
    return;
  }

  const now = new Date();
  const updated = await prisma.bookingCall.update({
    where: { id: callId },
    data: { status: 'ACCEPTED', answeredAt: now },
  });

  const serialized = serializeBookingCall(updated);
  emitBookingCallState(bookingId, serialized);

  res.status(200).json({
    status: true,
    data: {
      call: serialized,
      iceServers: buildIceServersForUser(userId),
    },
  });
};

/**
 * @Description Reject an incoming voice call
 * @Route POST /api/calling/:id/calls/:callId/reject
 * @Access Private
 */
export const rejectCall = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  const callId = req.params.callId;

  const access = await assertCallParticipant(callId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const call = access.call;
  if (call.bookingId !== bookingId || call.receiverUserId !== userId) {
    res.status(403).json({ status: false, msg: 'Only the receiver can reject this call' });
    return;
  }
  if (call.status !== 'RINGING') {
    res.status(400).json({ status: false, msg: 'Call is not ringing' });
    return;
  }

  const updated = await finalizeCall(callId, 'REJECTED');
  if (!updated) {
    res.status(404).json({ status: false, msg: 'Call not found' });
    return;
  }

  const serialized = serializeBookingCall(updated);
  emitBookingCallState(bookingId, serialized);

  res.status(200).json({ status: true, data: { call: serialized } });
};

/**
 * @Description End an active or ringing voice call
 * @Route POST /api/calling/:id/calls/:callId/end
 * @Access Private
 */
export const endCall = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  const callId = req.params.callId;

  const access = await assertCallParticipant(callId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const call = access.call;
  if (call.bookingId !== bookingId) {
    res.status(400).json({ status: false, msg: 'Call does not belong to this booking' });
    return;
  }
  if (call.status !== 'RINGING' && call.status !== 'ACCEPTED') {
    res.status(400).json({ status: false, msg: 'Call is already finished' });
    return;
  }

  let finalStatus: 'MISSED' | 'REJECTED' | 'ENDED' = 'ENDED';
  if (call.status === 'RINGING') {
    if (userId === call.receiverUserId) {
      finalStatus = 'REJECTED';
    } else if (userId === call.callerUserId) {
      finalStatus = 'ENDED';
    } else {
      finalStatus = 'MISSED';
    }
  }
  const updated = await finalizeCall(callId, finalStatus);
  if (!updated) {
    res.status(404).json({ status: false, msg: 'Call not found' });
    return;
  }

  const serialized = serializeBookingCall(updated);
  emitBookingCallState(bookingId, serialized);

  res.status(200).json({ status: true, data: { call: serialized } });
};
