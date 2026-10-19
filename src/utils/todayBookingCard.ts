import type { Booking, User } from '@prisma/client';
import prisma from '../config/db';

/**
 * Companion "Today booking" card top-right states (matches mobile mockups):
 * STARTS_IN → ENTER_OTP (when start time reached) → ENDS_IN (after OTP / active)
 * EXTEND is available as a secondary action while ACTIVE.
 */

export type TodayBookingCardPhase =
  | 'STARTS_IN'
  | 'ENTER_OTP'
  | 'ENDS_IN'
  | 'COMPLETED';

export type TodayBookingCardPayload = {
  id: number;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  address: string | null;
  activity: string | null;
  otpVerified: boolean;
  extensionStatus: string;
  clientId: number;
  companionId: number;
  cardPhase: TodayBookingCardPhase;
  /** ISO time to count down to; null for ENTER_OTP / COMPLETED */
  countdownTarget: string | null;
  canExtend: boolean;
  client: {
    id: number;
    username: string;
    profileImage: string | null;
  };
};

/** Socket envelope for companion today-card list. */
export type TodayBookingCardsSocketPayload = {
  bookings: TodayBookingCardPayload[];
};

type CardBooking = Pick<
  Booking,
  | 'id'
  | 'status'
  | 'date'
  | 'startTime'
  | 'endTime'
  | 'address'
  | 'activity'
  | 'otpVerified'
  | 'extensionStatus'
  | 'clientId'
  | 'companionId'
> & {
  client: Pick<User, 'id' | 'username' | 'profileImage'>;
};

export const todayBookingCardSelect = {
  id: true,
  status: true,
  date: true,
  startTime: true,
  endTime: true,
  address: true,
  activity: true,
  otpVerified: true,
  extensionStatus: true,
  clientId: true,
  companionId: true,
  client: {
    select: {
      id: true,
      username: true,
      profileImage: true,
    },
  },
} as const;

/**
 * Resolve which UI control the companion today-card should show.
 */
export function resolveTodayBookingCardPhase(
  booking: Pick<Booking, 'status' | 'startTime' | 'endTime' | 'otpVerified'>,
  now: Date = new Date()
): TodayBookingCardPhase {
  if (booking.status === 'COMPLETED') {
    return 'COMPLETED';
  }

  if (booking.status === 'ACTIVE') {
    return 'ENDS_IN';
  }

  // ACCEPTED (and any other pre-active confirmed status)
  if (now.getTime() < booking.startTime.getTime()) {
    return 'STARTS_IN';
  }

  if (!booking.otpVerified) {
    return 'ENTER_OTP';
  }

  return 'ENDS_IN';
}

/**
 * ISO timestamp the client should count down toward for the current phase.
 * null when there is no timer (ENTER_OTP / COMPLETED).
 */
export function resolveTodayBookingCountdownTarget(
  booking: Pick<Booking, 'startTime' | 'endTime'>,
  phase: TodayBookingCardPhase
): string | null {
  if (phase === 'STARTS_IN') {
    return booking.startTime.toISOString();
  }
  if (phase === 'ENDS_IN') {
    return booking.endTime.toISOString();
  }
  return null;
}

export function buildTodayBookingCardPayload(
  booking: CardBooking,
  now: Date = new Date()
): TodayBookingCardPayload {
  const cardPhase = resolveTodayBookingCardPhase(booking, now);
  return {
    id: booking.id,
    status: booking.status,
    date: booking.date.toISOString(),
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    address: booking.address,
    activity: booking.activity,
    otpVerified: booking.otpVerified,
    extensionStatus: booking.extensionStatus,
    clientId: booking.clientId,
    companionId: booking.companionId,
    cardPhase,
    countdownTarget: resolveTodayBookingCountdownTarget(booking, cardPhase),
    canExtend: booking.status === 'ACTIVE',
    client: {
      id: booking.client.id,
      username: booking.client.username,
      profileImage: booking.client.profileImage,
    },
  };
}

function todayWindow(now: Date = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Confirmed sessions for companion whose startTime is today (server local). */
export async function findTodayBookingsForCompanion(
  companionProfileId: number,
  now: Date = new Date()
): Promise<CardBooking[]> {
  const { start, end } = todayWindow(now);
  return prisma.booking.findMany({
    where: {
      companionId: companionProfileId,
      startTime: { gte: start, lt: end },
      status: { in: ['ACCEPTED', 'ACTIVE', 'COMPLETED'] },
    },
    orderBy: { startTime: 'asc' },
    select: todayBookingCardSelect,
  }) as Promise<CardBooking[]>;
}

export async function resolveTodayBookingCardsForCompanion(
  companionProfileId: number,
  now: Date = new Date()
): Promise<TodayBookingCardsSocketPayload> {
  const rows = await findTodayBookingsForCompanion(companionProfileId, now);
  return {
    bookings: rows.map((b) => buildTodayBookingCardPayload(b, now)),
  };
}

export async function resolveTodayBookingCardsForUser(
  userId: number
): Promise<TodayBookingCardsSocketPayload | null> {
  const profile = await prisma.companionProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return null;
  return resolveTodayBookingCardsForCompanion(profile.id);
}
