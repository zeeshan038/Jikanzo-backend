import type { Booking, CompanionProfile, User } from '@prisma/client';
import prisma from '../config/db';

/** Show feed/home blue bar this many ms before `startTime`. */
export const HOME_BAR_LEAD_MS = 30 * 60 * 1000;

export type HomeBarViewerRole = 'client' | 'companion';

export type HomeBarPayload = {
  visible: boolean;
  bookingId?: number;
  status?: string;
  /** PRE_START = accepted, within window; IN_SESSION = ACTIVE */
  phase?: 'PRE_START' | 'IN_SESSION';
  startTime?: string;
  endTime?: string;
  otp?: string | null;
  otpVerified?: boolean;
  minutesUntilStart?: number | null;
  /** Server-side hint for the blue bar (client may format locally). */
  label?: string;
  viewerRole?: HomeBarViewerRole;
  counterparty?: { id: number; username: string };
};

type BookingForBar = Booking & {
  client: Pick<User, 'id' | 'username'>;
  companion: Pick<CompanionProfile, 'id'> & { user: Pick<User, 'id' | 'username'> };
};

export function shouldShowHomeBar(
  booking: Pick<Booking, 'status' | 'startTime' | 'endTime'>,
  nowMs = Date.now()
): boolean {
  if (booking.status !== 'ACCEPTED' && booking.status !== 'ACTIVE') {
    return false;
  }
  const startMs = booking.startTime.getTime();
  const endMs = booking.endTime.getTime();
  if (nowMs < startMs - HOME_BAR_LEAD_MS) {
    return false;
  }
  if (nowMs >= endMs && booking.status !== 'ACTIVE') {
    return false;
  }
  if (booking.status === 'ACTIVE' && nowMs >= endMs) {
    return false;
  }
  return true;
}

function formatTimeLocal(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function buildLabel(booking: Pick<Booking, 'status' | 'startTime' | 'otp'>): string {
  const timeLabel = formatTimeLocal(booking.startTime);
  if (booking.status === 'ACTIVE') {
    return `Session in progress · ${timeLabel}`;
  }
  if (booking.otp) {
    return `Today's booking ${timeLabel} · OTP ${booking.otp}`;
  }
  return `Today's booking ${timeLabel}`;
}

export function buildHomeBarPayload(
  booking: BookingForBar,
  viewerRole: HomeBarViewerRole,
  nowMs = Date.now()
): HomeBarPayload {
  if (!shouldShowHomeBar(booking, nowMs)) {
    return { visible: false };
  }

  const startMs = booking.startTime.getTime();
  const minutesUntilStart =
    booking.status === 'ACCEPTED' && startMs > nowMs
      ? Math.max(0, Math.ceil((startMs - nowMs) / 60_000))
      : null;

  const counterparty =
    viewerRole === 'client'
      ? { id: booking.companion.user.id, username: booking.companion.user.username }
      : { id: booking.client.id, username: booking.client.username };

  return {
    visible: true,
    bookingId: booking.id,
    status: booking.status,
    phase: booking.status === 'ACTIVE' ? 'IN_SESSION' : 'PRE_START',
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    otp: booking.otp,
    otpVerified: booking.otpVerified,
    minutesUntilStart,
    label: buildLabel(booking),
    viewerRole,
    counterparty,
  };
}

export async function findHomeBarBookingForUser(
  userId: number,
  companionProfileId: number | null | undefined,
  nowMs = Date.now()
): Promise<{ booking: BookingForBar; viewerRole: HomeBarViewerRole } | null> {
  const now = new Date(nowMs);
  const latestStart = new Date(nowMs + HOME_BAR_LEAD_MS);

  const orFilters: { clientId?: number; companionId?: number }[] = [{ clientId: userId }];
  if (companionProfileId != null) {
    orFilters.push({ companionId: companionProfileId });
  }

  const candidates = await prisma.booking.findMany({
    where: {
      OR: orFilters,
      status: { in: ['ACCEPTED', 'ACTIVE'] },
      startTime: { lte: latestStart },
      endTime: { gt: now },
    },
    orderBy: { startTime: 'asc' },
    include: {
      client: { select: { id: true, username: true } },
      companion: {
        select: {
          id: true,
          user: { select: { id: true, username: true } },
        },
      },
    },
    take: 10,
  });

  candidates.sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
    return a.startTime.getTime() - b.startTime.getTime();
  });

  for (const booking of candidates) {
    if (!shouldShowHomeBar(booking, nowMs)) continue;
    const viewerRole: HomeBarViewerRole =
      booking.clientId === userId ? 'client' : 'companion';
    return { booking: booking as BookingForBar, viewerRole };
  }

  return null;
}

export async function resolveHomeBarForUser(userId: number): Promise<HomeBarPayload> {
  const companionProfile = await prisma.companionProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  const match = await findHomeBarBookingForUser(userId, companionProfile?.id ?? null);
  if (!match) {
    return { visible: false };
  }
  return buildHomeBarPayload(match.booking, match.viewerRole);
}
