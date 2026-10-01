import prisma from '../config/db';
import {
  buildTrackingStatePayload,
  isLiveTrackingAllowed,
  liveTrackingBlockedReason,
  loadBookingForTracking,
  resolveTrackingRole,
  assertRateLimit,
  validateCoordinates,
  type TrackingRole,
} from './bookingTracking';

type SessionResult =
  | { ok: false; status: number; msg: string; code?: string }
  | { ok: true; state: ReturnType<typeof buildTrackingStatePayload> };

function roleSharingField(role: TrackingRole) {
  return role === 'client' ? 'clientSharing' : 'companionSharing';
}

export async function joinTrackingSession(
  bookingId: number,
  userId: number,
  companionProfileId: number | null | undefined
): Promise<SessionResult> {
  const booking = await loadBookingForTracking(bookingId);
  if (!booking) {
    return { ok: false, status: 404, msg: 'Booking not found' };
  }

  const role = resolveTrackingRole(booking, userId, companionProfileId ?? null);
  if (!role) {
    return { ok: false, status: 403, msg: 'Unauthorized to access this booking' };
  }

  const blocked = liveTrackingBlockedReason(booking);
  if (blocked) {
    return { ok: false, status: 403, msg: blocked, code: 'TRACKING_NOT_ALLOWED' };
  }

  const sharingField = roleSharingField(role);
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      trackingSessionActive: true,
      trackingStartedAt: booking.trackingStartedAt ?? new Date(),
      [sharingField]: true,
    },
    include: { companion: { select: { userId: true } } },
  });

  return { ok: true, state: buildTrackingStatePayload(updated) };
}

export async function leaveTrackingSession(
  bookingId: number,
  userId: number,
  companionProfileId: number | null | undefined
): Promise<SessionResult> {
  const booking = await loadBookingForTracking(bookingId);
  if (!booking) {
    return { ok: false, status: 404, msg: 'Booking not found' };
  }

  const role = resolveTrackingRole(booking, userId, companionProfileId ?? null);
  if (!role) {
    return { ok: false, status: 403, msg: 'Unauthorized to access this booking' };
  }

  const sharingField = roleSharingField(role);
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { [sharingField]: false },
    include: { companion: { select: { userId: true } } },
  });

  const stillSharing = updated.clientSharing || updated.companionSharing;
  if (!stillSharing && updated.trackingSessionActive) {
    const ended = await prisma.booking.update({
      where: { id: bookingId },
      data: { trackingSessionActive: false },
      include: { companion: { select: { userId: true } } },
    });
    return { ok: true, state: buildTrackingStatePayload(ended) };
  }

  return { ok: true, state: buildTrackingStatePayload(updated) };
}

export async function applyTrackingLocationUpdate(
  bookingId: number,
  userId: number,
  companionProfileId: number | null | undefined,
  latitude: number,
  longitude: number,
  heading?: number,
  accuracy?: number
): Promise<
  | { ok: false; status: number; msg: string; code?: string; rateLimited?: boolean }
  | {
      ok: true;
      location: {
        bookingId: number;
        role: TrackingRole;
        userId: number;
        latitude: number;
        longitude: number;
        heading: number | null;
        accuracy: number | null;
        updatedAt: string;
        distanceToMeetingKm: number | null;
        etaToMeetingMinutes: number | null;
        distanceBetweenKm: number | null;
      };
      state: ReturnType<typeof buildTrackingStatePayload>;
    }
> {
  const coordErr = validateCoordinates(latitude, longitude);
  if (coordErr) {
    return { ok: false, status: 400, msg: coordErr };
  }

  if (!assertRateLimit(bookingId, userId)) {
    return { ok: false, status: 429, msg: 'Too many location updates', rateLimited: true };
  }

  const booking = await loadBookingForTracking(bookingId);
  if (!booking) {
    return { ok: false, status: 404, msg: 'Booking not found' };
  }

  const role = resolveTrackingRole(booking, userId, companionProfileId ?? null);
  if (!role) {
    return { ok: false, status: 403, msg: 'Unauthorized to access this booking' };
  }

  if (!isLiveTrackingAllowed(booking)) {
    return {
      ok: false,
      status: 403,
      msg: liveTrackingBlockedReason(booking) ?? 'Tracking not allowed',
      code: 'TRACKING_NOT_ALLOWED',
    };
  }

  const now = new Date();
  const positionData =
    role === 'client'
      ? {
          clientSharing: true,
          clientLastLat: latitude,
          clientLastLng: longitude,
          clientLastTrackedAt: now,
          trackingSessionActive: true,
          trackingStartedAt: booking.trackingStartedAt ?? now,
        }
      : {
          companionSharing: true,
          companionLastLat: latitude,
          companionLastLng: longitude,
          companionLastTrackedAt: now,
          trackingSessionActive: true,
          trackingStartedAt: booking.trackingStartedAt ?? now,
        };

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: positionData,
    include: { companion: { select: { userId: true } } },
  });

  const state = buildTrackingStatePayload(updated);
  const participant = role === 'client' ? state.client : state.companion;

  return {
    ok: true,
    location: {
      bookingId,
      role,
      userId,
      latitude,
      longitude,
      heading: heading != null && Number.isFinite(heading) ? heading : null,
      accuracy: accuracy != null && Number.isFinite(accuracy) ? accuracy : null,
      updatedAt: now.toISOString(),
      distanceToMeetingKm: participant.distanceToMeetingKm,
      etaToMeetingMinutes: participant.etaToMeetingMinutes,
      distanceBetweenKm: state.distanceBetweenKm,
    },
    state,
  };
}

export async function endBookingTrackingSession(bookingId: number) {
  const booking = await loadBookingForTracking(bookingId);
  if (!booking?.trackingSessionActive) {
    return null;
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      trackingSessionActive: false,
      clientSharing: false,
      companionSharing: false,
    },
    include: { companion: { select: { userId: true } } },
  });
}
