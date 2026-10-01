import type { Socket } from 'socket.io';
import { SOCKET_CLIENT_EVENTS } from './constants';
import {
  emitBookingTrackingLocation,
  emitBookingTrackingState,
} from './bookingEmit';
import {
  applyTrackingLocationUpdate,
  joinTrackingSession,
  leaveTrackingSession,
} from '../utils/bookingTrackingSession';

export function registerBookingTrackingHandlers(socket: Socket) {
  const userId = socket.data.userId as number;
  const companionProfileId = socket.data.companionProfileId as number | undefined;

  socket.on(SOCKET_CLIENT_EVENTS.TRACKING_JOIN, async (payload: { bookingId?: number }) => {
    const bookingId = Number(payload?.bookingId);
    if (!Number.isFinite(bookingId)) return;

    const result = await joinTrackingSession(bookingId, userId, companionProfileId ?? null);
    if (!result.ok) {
      socket.emit('booking:tracking:error', {
        bookingId,
        msg: result.msg,
        code: result.code,
      });
      return;
    }

    emitBookingTrackingState(bookingId, result.state);
  });

  socket.on(
    SOCKET_CLIENT_EVENTS.TRACKING_UPDATE,
    async (payload: {
      bookingId?: number;
      latitude?: number;
      longitude?: number;
      heading?: number;
      accuracy?: number;
    }) => {
      const bookingId = Number(payload?.bookingId);
      const latitude = Number(payload?.latitude);
      const longitude = Number(payload?.longitude);
      if (!Number.isFinite(bookingId) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const result = await applyTrackingLocationUpdate(
        bookingId,
        userId,
        companionProfileId ?? null,
        latitude,
        longitude,
        payload?.heading,
        payload?.accuracy
      );

      if (!result.ok) {
        if (!result.rateLimited) {
          socket.emit('booking:tracking:error', {
            bookingId,
            msg: result.msg,
            code: result.code,
          });
        }
        return;
      }

      emitBookingTrackingLocation(bookingId, result.location);
    }
  );

  socket.on(SOCKET_CLIENT_EVENTS.TRACKING_LEAVE, async (payload: { bookingId?: number }) => {
    const bookingId = Number(payload?.bookingId);
    if (!Number.isFinite(bookingId)) return;

    const result = await leaveTrackingSession(bookingId, userId, companionProfileId ?? null);
    if (!result.ok) {
      socket.emit('booking:tracking:error', {
        bookingId,
        msg: result.msg,
        code: result.code,
      });
      return;
    }

    emitBookingTrackingState(bookingId, result.state);
  });
}
