import { Server } from 'socket.io';
import prisma from '../config/db';
import {
  bookingDetailInclude,
  buildClientSummary,
  buildCompanionPublicProfile,
  buildPaymentSummary,
} from '../utils/bookingHelpers';
import { BOOKING_REQUEST_EXPIRY_MS, SOCKET_EVENTS } from './constants';
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
