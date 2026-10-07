import type { Booking } from '@prisma/client';
import { HOME_BAR_LEAD_MS } from './bookingHomeBar';

export type CoordinationWindow = {
  opensAt: Date;
  closesAt: Date;
};

export function getBookingCoordinationWindow(
  booking: Pick<Booking, 'startTime' | 'endTime'>
): CoordinationWindow {
  return {
    opensAt: new Date(booking.startTime.getTime() - HOME_BAR_LEAD_MS),
    closesAt: booking.endTime,
  };
}

export function isBookingCoordinationOpen(
  booking: Pick<Booking, 'status' | 'startTime' | 'endTime'>,
  nowMs = Date.now()
): boolean {
  if (booking.status !== 'ACCEPTED' && booking.status !== 'ACTIVE') {
    return false;
  }
  const { opensAt, closesAt } = getBookingCoordinationWindow(booking);
  const t = nowMs;
  return t >= opensAt.getTime() && t < closesAt.getTime();
}

export function coordinationUnavailableReason(
  booking: Pick<Booking, 'status' | 'startTime' | 'endTime'>,
  nowMs = Date.now()
): string | null {
  if (isBookingCoordinationOpen(booking, nowMs)) {
    return null;
  }
  if (booking.status === 'CANCELLED') {
    return 'This booking was cancelled.';
  }
  if (booking.status === 'COMPLETED') {
    return 'This booking has ended.';
  }
  if (booking.status === 'PENDING') {
    return 'Chat and calls are available after the companion accepts the booking.';
  }
  const { opensAt, closesAt } = getBookingCoordinationWindow(booking);
  if (booking.status === 'ACCEPTED' || booking.status === 'ACTIVE') {
    if (nowMs < opensAt.getTime()) {
      return 'Chat and calls open 30 minutes before your booking start time.';
    }
    if (nowMs >= closesAt.getTime()) {
      return 'The coordination window for this booking has ended.';
    }
  }
  return 'Chat and calls are not available for this booking.';
}

export function buildCoordinationStatus(
  booking: Pick<Booking, 'status' | 'startTime' | 'endTime'>,
  nowMs = Date.now()
) {
  const { opensAt, closesAt } = getBookingCoordinationWindow(booking);
  const available = isBookingCoordinationOpen(booking, nowMs);
  return {
    available,
    reason: available ? null : coordinationUnavailableReason(booking, nowMs),
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
  };
}
