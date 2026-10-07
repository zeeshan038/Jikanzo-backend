import { Server } from 'socket.io';
import prisma from '../config/db';
import {
  bookingDetailInclude,
  buildClientSummary,
  buildCompanionPublicProfile,
  buildPaymentSummary,
} from '../utils/bookingHelpers';
import {
  BOOKING_REQUEST_EXPIRY_MS,
  EXTENSION_PROMPT_TYPES,
  SOCKET_EVENTS,
} from './constants';
import { bookingRoom, companionRoom, userRoom } from './rooms';

let io: Server | null = null;

export function setSocketServer(server: Server) {
  io = server;
}

export function getSocketServer(): Server | null {
  return io;
}

/** True if the user has an active socket joined to this booking chat room. */
export function isUserInBookingChatRoom(userId: number, bookingId: number): boolean {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(bookingRoom(bookingId));
  if (!room) return false;
  for (const socketId of room) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock?.data?.userId === userId) return true;
  }
  return false;
}

export async function countPendingRequests(companionProfileId: number): Promise<number> {
  return prisma.booking.count({
    where: { companionId: companionProfileId, status: 'PENDING' },
  });
}

async function buildCompanionRequestPreview(bookingId: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingDetailInclude,
  });
  if (!booking) return null;

  const paymentSummary = buildPaymentSummary(booking);
  const expiresAt = new Date(booking.createdAt.getTime() + BOOKING_REQUEST_EXPIRY_MS);

  return {
    id: booking.id,
    status: booking.status,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    address: booking.address,
    activity: booking.activity,
    paymentStatus: booking.paymentStatus,
    createdAt: booking.createdAt,
    requestExpiresAt: booking.status === 'PENDING' ? expiresAt : null,
    client: buildClientSummary(booking),
    paymentSummary,
  };
}

async function buildBookingUpdatePayload(bookingId: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingDetailInclude,
  });
  if (!booking) return null;

  const paymentSummary = buildPaymentSummary(booking);
  const expiresAt = new Date(booking.createdAt.getTime() + BOOKING_REQUEST_EXPIRY_MS);

  return {
    id: booking.id,
    status: booking.status,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    address: booking.address,
    activity: booking.activity,
    paymentStatus: booking.paymentStatus,
    extensionStatus: booking.extensionStatus,
    extensionHours: booking.extensionHours,
    extensionAmount: booking.extensionAmount,
    extensionPaymentStatus: booking.extensionPaymentStatus,
    cancellationReason: booking.cancellationReason,
    cancellationReasonCode: booking.cancellationReasonCode,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    requestExpiresAt: booking.status === 'PENDING' ? expiresAt : null,
    client: buildClientSummary(booking),
    companionProfile: buildCompanionPublicProfile(booking),
    paymentSummary,
  };
}

async function emitRequestsCount(companionProfileId: number) {
  if (!io) return;
  const pendingCount = await countPendingRequests(companionProfileId);
  io.to(companionRoom(companionProfileId)).emit(SOCKET_EVENTS.REQUESTS_COUNT, { pendingCount });
}

export async function emitBookingRequestNew(bookingId: number, companionProfileId: number) {
  if (!io) return;

  const preview = await buildCompanionRequestPreview(bookingId);
  const pendingCount = await countPendingRequests(companionProfileId);

  io.to(companionRoom(companionProfileId)).emit(SOCKET_EVENTS.REQUEST_NEW, {
    bookingId,
    pendingCount,
    preview,
  });
  io.to(companionRoom(companionProfileId)).emit(SOCKET_EVENTS.REQUESTS_COUNT, { pendingCount });
}

export async function emitBookingRequestUpdated(bookingId: number) {
  if (!io) return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, clientId: true, companionId: true, status: true },
  });
  if (!booking) return;

  const payload = await buildBookingUpdatePayload(bookingId);
  if (!payload) return;

  const eventPayload = { bookingId, ...payload };

  io.to(bookingRoom(bookingId)).emit(SOCKET_EVENTS.REQUEST_UPDATED, eventPayload);
  io.to(userRoom(booking.clientId)).emit(SOCKET_EVENTS.REQUEST_UPDATED, eventPayload);
  io.to(companionRoom(booking.companionId)).emit(SOCKET_EVENTS.REQUEST_UPDATED, eventPayload);

  await emitRequestsCount(booking.companionId);
}

export async function emitBookingRequestExpired(
  bookingId: number,
  companionProfileId: number,
  clientId: number
) {
  if (!io) return;

  const eventPayload = { bookingId };

  io.to(bookingRoom(bookingId)).emit(SOCKET_EVENTS.REQUEST_EXPIRED, eventPayload);
  io.to(userRoom(clientId)).emit(SOCKET_EVENTS.REQUEST_EXPIRED, eventPayload);
  io.to(companionRoom(companionProfileId)).emit(SOCKET_EVENTS.REQUEST_EXPIRED, eventPayload);

  await emitRequestsCount(companionProfileId);
}

export async function emitInitialCompanionCount(companionProfileId: number) {
  await emitRequestsCount(companionProfileId);
}

async function buildExtensionSheetPayload(bookingId: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingDetailInclude,
  });
  if (!booking) return null;

  const currency = process.env.BOOKING_CURRENCY || 'USD';

  return {
    bookingId: booking.id,
    status: booking.status,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    address: booking.address,
    activity: booking.activity,
    paymentStatus: booking.paymentStatus,
    extensionStatus: booking.extensionStatus,
    extensionHours: booking.extensionHours,
    extensionAmount: booking.extensionAmount,
    extensionPaymentStatus: booking.extensionPaymentStatus,
    currency,
    client: buildClientSummary(booking),
    companionProfile: buildCompanionPublicProfile(booking),
    paymentSummary: buildPaymentSummary(booking),
  };
}

function emitExtensionEventToParties(
  eventName: string,
  bookingId: number,
  clientId: number,
  companionProfileId: number,
  payload: object
) {
  if (!io) return;
  io.to(bookingRoom(bookingId)).emit(eventName, payload);
  io.to(userRoom(clientId)).emit(eventName, payload);
  io.to(companionRoom(companionProfileId)).emit(eventName, payload);
}

/** After POST /api/booking/request-extension/:id */
export async function emitBookingExtensionRequested(bookingId: number) {
  if (!io) return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, companionId: true },
  });
  if (!booking) return;

  const sheet = await buildExtensionSheetPayload(bookingId);
  if (!sheet) return;

  const eventPayload = {
    ...sheet,
    bottomSheet: {
      companion: true,
      client: true,
    },
  };

  emitExtensionEventToParties(
    SOCKET_EVENTS.EXTENSION_REQUESTED,
    bookingId,
    booking.clientId,
    booking.companionId,
    eventPayload
  );
}

/** After POST /api/booking/respond-extension/:id */
export async function emitBookingExtensionUpdated(bookingId: number) {
  if (!io) return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, companionId: true },
  });
  if (!booking) return;

  const sheet = await buildExtensionSheetPayload(bookingId);
  if (!sheet) return;

  const eventPayload = {
    ...sheet,
    bottomSheet: {
      companion: sheet.extensionStatus === 'PENDING',
      client: sheet.extensionStatus === 'PENDING',
    },
  };

  emitExtensionEventToParties(
    SOCKET_EVENTS.EXTENSION_UPDATED,
    bookingId,
    booking.clientId,
    booking.companionId,
    eventPayload
  );
}

export type ExtensionPromptType =
  (typeof EXTENSION_PROMPT_TYPES)[keyof typeof EXTENSION_PROMPT_TYPES];

/** Cron / reminders — client-only extension bottom sheet before meeting start. */
export async function emitBookingExtensionPrompt(
  bookingId: number,
  promptType: ExtensionPromptType
) {
  if (!io) return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, companionId: true },
  });
  if (!booking) return;

  const sheet = await buildExtensionSheetPayload(bookingId);
  if (!sheet) return;

  const eventPayload = {
    ...sheet,
    promptType,
    bottomSheet: {
      client: true,
      companion: false,
    },
  };

  io.to(bookingRoom(bookingId)).emit(SOCKET_EVENTS.EXTENSION_PROMPT, eventPayload);
  io.to(userRoom(booking.clientId)).emit(SOCKET_EVENTS.EXTENSION_PROMPT, eventPayload);
}

export type BookingMessageSocketPayload = {
  id: number;
  bookingId: number;
  senderUserId: number;
  messageId: string | null;
  text: string;
  imageUrl: string | null;
  kind: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
};

export async function emitBookingMessageNew(
  bookingId: number,
  message: BookingMessageSocketPayload
) {
  if (!io) return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, companion: { select: { userId: true } } },
  });
  if (!booking) return;

  const payload = {
    bookingId,
    message: {
      ...message,
      createdAt: message.createdAt.toISOString(),
    },
  };

  io.to(bookingRoom(bookingId)).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
  io.to(userRoom(booking.clientId)).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
  if (booking.companion.userId) {
    io.to(userRoom(booking.companion.userId)).emit(SOCKET_EVENTS.MESSAGE_NEW, payload);
  }
}

export async function emitBookingCoordinationClosed(
  bookingId: number,
  reason = 'Chat and calls are no longer available for this booking.'
) {
  if (!io) return;

  const { endActiveCallsForBooking } = await import('../utils/bookingCallService');
  await endActiveCallsForBooking(bookingId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, companion: { select: { userId: true } } },
  });
  if (!booking) return;

  const payload = { bookingId, reason };

  io.to(bookingRoom(bookingId)).emit(SOCKET_EVENTS.MESSAGING_CLOSED, payload);
  io.to(bookingRoom(bookingId)).emit(SOCKET_EVENTS.COORDINATION_CLOSED, payload);
  io.to(userRoom(booking.clientId)).emit(SOCKET_EVENTS.MESSAGING_CLOSED, payload);
  io.to(userRoom(booking.clientId)).emit(SOCKET_EVENTS.COORDINATION_CLOSED, payload);
  if (booking.companion.userId) {
    io.to(userRoom(booking.companion.userId)).emit(SOCKET_EVENTS.MESSAGING_CLOSED, payload);
    io.to(userRoom(booking.companion.userId)).emit(SOCKET_EVENTS.COORDINATION_CLOSED, payload);
  }
}

/** @deprecated Use emitBookingCoordinationClosed */
export async function emitBookingMessagingClosed(bookingId: number) {
  await emitBookingCoordinationClosed(bookingId);
}

export async function emitBookingCoordinationOpened(bookingId: number) {
  if (!io) return;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      clientId: true,
      status: true,
      startTime: true,
      endTime: true,
      companion: { select: { userId: true } },
    },
  });
  if (!booking) return;

  const { buildCoordinationStatus } = await import('../utils/bookingCoordination');
  const coordination = buildCoordinationStatus(booking);
  const payload = { bookingId, ...coordination };

  io.to(bookingRoom(bookingId)).emit(SOCKET_EVENTS.COORDINATION_OPENED, payload);
  io.to(userRoom(booking.clientId)).emit(SOCKET_EVENTS.COORDINATION_OPENED, payload);
  if (booking.companion.userId) {
    io.to(userRoom(booking.companion.userId)).emit(SOCKET_EVENTS.COORDINATION_OPENED, payload);
  }
}

function emitCallToBookingParticipants(
  bookingId: number,
  event: string,
  payload: unknown,
  targetUserId?: number
) {
  if (!io) return;
  void prisma.booking
    .findUnique({
      where: { id: bookingId },
      select: { clientId: true, companion: { select: { userId: true } } },
    })
    .then((booking) => {
      if (!booking || !io) return;
      if (targetUserId != null) {
        io.to(userRoom(targetUserId)).emit(event, payload);
        return;
      }
      io.to(bookingRoom(bookingId)).emit(event, payload);
      io.to(userRoom(booking.clientId)).emit(event, payload);
      if (booking.companion.userId) {
        io.to(userRoom(booking.companion.userId)).emit(event, payload);
      }
    });
}

export function emitBookingCallIncoming(
  bookingId: number,
  call: Record<string, unknown>,
  receiverUserId: number
) {
  emitCallToBookingParticipants(
    bookingId,
    SOCKET_EVENTS.CALL_INCOMING,
    { bookingId, call },
    receiverUserId
  );
}

export function emitBookingCallState(bookingId: number, call: Record<string, unknown>) {
  emitCallToBookingParticipants(bookingId, SOCKET_EVENTS.CALL_STATE, { bookingId, call });
}

export function emitBookingCallSignal(
  bookingId: number,
  targetUserId: number,
  payload: {
    callId: string;
    fromUserId: number;
    signalType: string;
    sdp?: string;
    candidate?: unknown;
  }
) {
  emitCallToBookingParticipants(bookingId, SOCKET_EVENTS.CALL_SIGNAL, payload, targetUserId);
}

function emitTrackingToBookingParticipants(bookingId: number, event: string, payload: unknown) {
  if (!io) return;
  void prisma.booking
    .findUnique({
      where: { id: bookingId },
      select: { clientId: true, companion: { select: { userId: true } } },
    })
    .then((booking) => {
      if (!booking || !io) return;
      io.to(bookingRoom(bookingId)).emit(event, payload);
      io.to(userRoom(booking.clientId)).emit(event, payload);
      if (booking.companion.userId) {
        io.to(userRoom(booking.companion.userId)).emit(event, payload);
      }
    });
}

export function emitBookingTrackingState(
  bookingId: number,
  state: Record<string, unknown>
) {
  emitTrackingToBookingParticipants(bookingId, SOCKET_EVENTS.TRACKING_STATE, state);
}

export function emitBookingTrackingLocation(
  bookingId: number,
  location: Record<string, unknown>
) {
  emitTrackingToBookingParticipants(bookingId, SOCKET_EVENTS.TRACKING_LOCATION, location);
}

export async function emitBookingTrackingEnded(bookingId: number, reason: string) {
  emitTrackingToBookingParticipants(bookingId, SOCKET_EVENTS.TRACKING_ENDED, {
    bookingId,
    reason,
  });
}

export async function endBookingTrackingAndNotify(bookingId: number, reason: string) {
  const { endBookingTrackingSession } = await import('../utils/bookingTrackingSession');
  const updated = await endBookingTrackingSession(bookingId);
  if (updated) {
    await emitBookingTrackingEnded(bookingId, reason);
  }
}

export async function emitHomeBarToUser(userId: number) {
  if (!io) return;
  const { resolveHomeBarForUser } = await import('../utils/bookingHomeBar');
  const payload = await resolveHomeBarForUser(userId);
  io.to(userRoom(userId)).emit(SOCKET_EVENTS.HOME_BAR, payload);
}

export async function refreshHomeBarForBooking(bookingId: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, companion: { select: { userId: true } } },
  });
  if (!booking) return;
  await emitHomeBarToUser(booking.clientId);
  if (booking.companion.userId) {
    await emitHomeBarToUser(booking.companion.userId);
  }
}

export function emitInitialHomeBar(userId: number) {
  void emitHomeBarToUser(userId);
}
