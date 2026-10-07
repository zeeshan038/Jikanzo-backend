import type { Booking, CompanionProfile } from '@prisma/client';
import prisma from '../config/db';
import {
  coordinationUnavailableReason,
  isBookingCoordinationOpen,
} from './bookingCoordination';
import { calculateDistance } from './methods';

export type TrackingRole = 'client' | 'companion';

export type BookingWithCompanionUser = Booking & {
  companion: Pick<CompanionProfile, 'userId'>;
};

const ASSUMED_SPEED_KMH = 30;
const MIN_UPDATE_INTERVAL_MS = 3000;

const lastUpdateByKey = new Map<string, number>();

export function isLiveTrackingAllowed(
  booking: Pick<Booking, 'status' | 'startTime' | 'endTime'>,
  nowMs?: number
): boolean {
  return isBookingCoordinationOpen(booking, nowMs);
}

export function liveTrackingBlockedReason(
  booking: Pick<Booking, 'status' | 'startTime' | 'endTime'>,
  nowMs?: number
): string | null {
  if (isLiveTrackingAllowed(booking, nowMs)) return null;
  return coordinationUnavailableReason(booking, nowMs) ?? 'Live tracking is not available.';
}

export function resolveTrackingRole(
  booking: Pick<Booking, 'clientId' | 'companionId'>,
  userId: number,
  companionProfileId: number | null | undefined
): TrackingRole | null {
  if (booking.clientId === userId) return 'client';
  if (companionProfileId != null && booking.companionId === companionProfileId) {
    return 'companion';
  }
  return null;
}

function roughEtaMinutes(distanceKm: number): number | null {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  return Math.max(1, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60));
}

function participantSnapshot(
  role: TrackingRole,
  userId: number,
  sharing: boolean,
  lat: number | null,
  lng: number | null,
  updatedAt: Date | null,
  meetingLat: number | null,
  meetingLng: number | null
) {
  let distanceToMeetingKm: number | null = null;
  let etaToMeetingMinutes: number | null = null;
  if (lat != null && lng != null && meetingLat != null && meetingLng != null) {
    distanceToMeetingKm =
      Math.round(calculateDistance(lat, lng, meetingLat, meetingLng) * 100) / 100;
    etaToMeetingMinutes = roughEtaMinutes(distanceToMeetingKm);
  }
  return {
    role,
    userId,
    sharing,
    latitude: lat,
    longitude: lng,
    updatedAt: updatedAt?.toISOString() ?? null,
    distanceToMeetingKm,
    etaToMeetingMinutes,
  };
}

export function buildTrackingStatePayload(booking: BookingWithCompanionUser) {
  const meetingLat = booking.latitude;
  const meetingLng = booking.longitude;

  let distanceBetweenKm: number | null = null;
  if (
    booking.clientLastLat != null &&
    booking.clientLastLng != null &&
    booking.companionLastLat != null &&
    booking.companionLastLng != null
  ) {
    distanceBetweenKm =
      Math.round(
        calculateDistance(
          booking.clientLastLat,
          booking.clientLastLng,
          booking.companionLastLat,
          booking.companionLastLng
        ) * 100
      ) / 100;
  }

  const meeting = {
    latitude: meetingLat,
    longitude: meetingLng,
    address: booking.address,
    hasCoordinates: meetingLat != null && meetingLng != null,
  };

  const client = participantSnapshot(
    'client',
    booking.clientId,
    booking.clientSharing,
    booking.clientLastLat,
    booking.clientLastLng,
    booking.clientLastTrackedAt,
    meetingLat,
    meetingLng
  );

  const companion = participantSnapshot(
    'companion',
    booking.companion.userId,
    booking.companionSharing,
    booking.companionLastLat,
    booking.companionLastLng,
    booking.companionLastTrackedAt,
    meetingLat,
    meetingLng
  );

  /** One entry per map pin — client, companion, and booking meeting place (static). */
  const markers = [
    {
      pinId: 'meeting',
      kind: 'meeting' as const,
      label: booking.address ?? 'Meeting point',
      latitude: meeting.latitude,
      longitude: meeting.longitude,
      isLive: false,
      visible: meeting.hasCoordinates,
    },
    {
      pinId: 'client',
      kind: 'client' as const,
      userId: client.userId,
      label: 'Client',
      latitude: client.latitude,
      longitude: client.longitude,
      isLive: true,
      sharing: client.sharing,
      updatedAt: client.updatedAt,
      visible: client.latitude != null && client.longitude != null,
    },
    {
      pinId: 'companion',
      kind: 'companion' as const,
      userId: companion.userId,
      label: 'Companion',
      latitude: companion.latitude,
      longitude: companion.longitude,
      isLive: true,
      sharing: companion.sharing,
      updatedAt: companion.updatedAt,
      visible: companion.latitude != null && companion.longitude != null,
    },
  ];

  return {
    bookingId: booking.id,
    sessionActive: booking.trackingSessionActive,
    allowed: isLiveTrackingAllowed(booking),
    reason: liveTrackingBlockedReason(booking),
    meeting,
    client,
    companion,
    markers,
    distanceBetweenKm,
  };
}

export async function loadBookingForTracking(bookingId: number) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { companion: { select: { userId: true } } },
  });
}

export function assertRateLimit(bookingId: number, userId: number): boolean {
  const key = `${bookingId}:${userId}`;
  const now = Date.now();
  const last = lastUpdateByKey.get(key) ?? 0;
  if (now - last < MIN_UPDATE_INTERVAL_MS) {
    return false;
  }
  lastUpdateByKey.set(key, now);
  return true;
}

export function validateCoordinates(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return 'Invalid latitude';
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return 'Invalid longitude';
  }
  return null;
}
