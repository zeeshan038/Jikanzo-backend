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
