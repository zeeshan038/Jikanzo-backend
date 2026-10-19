import { Booking, CompanionProfile, User } from '@prisma/client';
import { resolveCompanionHourlyRate } from '../constants/companionPricing';
import { calculatePaymentBreakdown, getStoredOrComputedBreakdown } from './bookingFinance';

export const BOOKING_REQUEST_EXPIRY_MS = 30 * 60 * 1000;

/** UI picker: 30 minutes + whole hours 1–12. */
export const ALLOWED_EXTENSION_HOURS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export const bookingDurationHours = (startTime: Date, endTime: Date): number => {
  const durationMs = endTime.getTime() - startTime.getTime();
  return durationMs > 0 ? Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100 : 0;
};

/** Normalize and validate extension length (0.5 = 30 minutes). */
export const parseExtensionHours = (raw: unknown): number | null => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const match = ALLOWED_EXTENSION_HOURS.find((h) => Math.abs(h - n) < 1e-9);
  return match ?? null;
};

export const formatExtensionDuration = (hours: number): string => {
  if (Math.abs(hours - 0.5) < 1e-9) return '30 minutes';
  if (hours === 1) return '1 hour';
  if (Number.isInteger(hours)) return `${hours} hours`;
  const minutes = Math.round(hours * 60);
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? '1 hour' : `${h} hours`;
  }
  if (minutes < 60) return `${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} hour${h === 1 ? '' : 's'} ${m} minutes`;
};

export const addExtensionToEndTime = (endTime: Date, extensionHours: number): Date => {
  return new Date(endTime.getTime() + extensionHours * 60 * 60 * 1000);
};

export const normalizeBookingListType = (type: unknown): string | undefined => {
  if (typeof type !== 'string') return undefined;
  if (type === 'pending') return 'requests';
  return type;
};

type BookingWithRelations = Booking & {
  client: Pick<User, 'id' | 'username' | 'profileImage' | 'age' | 'languages' | 'activityType' | 'about' | 'gallery'>;
  companion: CompanionProfile & {
    user: Pick<User, 'id' | 'username' | 'profileImage' | 'age' | 'languages' | 'activityType' | 'about' | 'gallery'>;
  };
};

export const buildCompanionPublicProfile = (booking: BookingWithRelations) => ({
  id: booking.companion.id,
  bio: booking.companion.bio,
  hourlyRate: resolveCompanionHourlyRate(booking.companion.hourlyRate),
  rating: booking.companion.rating,
  trustRank: booking.companion.trustRank,
  totalSessions: booking.companion.totalSessions,
  repeatClients: booking.companion.repeatClients,
  jssScore: booking.companion.jssScore,
  completedMeetups: booking.companion.completedMeetups,
  reliabilityScore: booking.companion.reliabilityScore,
  user: {
    id: booking.companion.user.id,
    username: booking.companion.user.username,
    profileImage: booking.companion.user.profileImage,
    age: booking.companion.user.age,
    languages: booking.companion.user.languages,
    activityType: booking.companion.user.activityType,
    about: booking.companion.user.about,
    gallery: booking.companion.user.gallery,
  },
});

/** Slim companion block for GET /api/booking/detail/:id */
export const buildCompanionBookingDetailProfile = (booking: BookingWithRelations) => ({
  id: booking.companion.id,
  bio: booking.companion.bio,
  rating: booking.companion.rating,
  trustRank: booking.companion.trustRank,
  totalSessions: booking.companion.totalSessions,
  repeatClients: booking.companion.repeatClients,
  completedMeetups: booking.companion.completedMeetups,
  user: {
    id: booking.companion.user.id,
    username: booking.companion.user.username,
    profileImage: booking.companion.user.profileImage,
    age: booking.companion.user.age,
  },
});

export const buildClientSummary = (booking: BookingWithRelations) => ({
  id: booking.client.id,
  username: booking.client.username,
  profileImage: booking.client.profileImage,
  age: booking.client.age,
});

export const buildPaymentSummary = (booking: BookingWithRelations) => {
  const breakdown = getStoredOrComputedBreakdown(booking);
  const durationHours = bookingDurationHours(booking.startTime, booking.endTime);
  const hourlyRate = resolveCompanionHourlyRate(booking.companion.hourlyRate);
  const expectedEarnings = breakdown.companionNetAmount;

  return {
    durationHours,
    durationLabel: durationHours === 1 ? '1 Hour' : `${durationHours} Hours`,
    hourlyRate,
    currency: process.env.BOOKING_CURRENCY || 'USD',
    paymentStatus: booking.paymentStatus,
    ...breakdown,
    expectedCompanionEarnings: expectedEarnings,
  };
};

export const recalculateBookingAmount = (hourlyRate: number, startTime: Date, endTime: Date) => {
  const durationHours = bookingDurationHours(startTime, endTime);
  const gross = durationHours * hourlyRate;
  const breakdown = calculatePaymentBreakdown(gross > 0 ? gross : 0);
  return {
    durationHours,
    totalAmount: breakdown.grossAmount,
    ...breakdown,
  };
};

export const bookingDetailInclude = {
  client: {
    select: {
      id: true,
      username: true,
      profileImage: true,
      age: true,
      languages: true,
      activityType: true,
      about: true,
      gallery: true,
    },
  },
  companion: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          profileImage: true,
          age: true,
          languages: true,
          activityType: true,
          about: true,
          gallery: true,
        },
      },
    },
  },
} as const;

export const listBookingSelect = {
  id: true,
  status: true,
  date: true,
  startTime: true,
  endTime: true,
  address: true,
  activity: true,
  totalAmount: true,
  paymentStatus: true,
  extensionStatus: true,
  extensionHours: true,
  extensionAmount: true,
  cancellationReason: true,
  cancellationReasonCode: true,
  otpVerified: true,
  createdAt: true,
  companion: {
    select: {
      id: true,
      user: {
        select: { username: true, profileImage: true, age: true },
      },
    },
  },
  client: {
    select: { id: true, username: true, profileImage: true, age: true },
  },
};
