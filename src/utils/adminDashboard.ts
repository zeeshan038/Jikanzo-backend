import { AdminRole, PrismaClient } from '@prisma/client';
import {
  ADMIN_DASHBOARD_CARD_META,
  ADMIN_DASHBOARD_CARDS_BY_ROLE,
  AdminDashboardDateRange,
  AdminDashboardMetricRaw,
  AdminDashboardStatCard,
  AdminDashboardStatCardKey,
  AdminDashboardStatsData,
} from '../types/adminDashboard';

const CLIENT_ROLES = ['CLIENT', 'BOTH'] as const;

export function parseAdminDashboardDateRange(query: {
  startDate?: string;
  endDate?: string;
}): AdminDashboardDateRange {
  const end = query.endDate ? new Date(query.endDate) : new Date();
  const start = query.startDate
    ? new Date(query.startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error('Invalid startDate or endDate');
  }

  const spanMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - spanMs);

  const dayEnds: Date[] = [];
  const cursor = new Date(start);
  cursor.setHours(23, 59, 59, 999);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  while (cursor <= endDay) {
    dayEnds.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(23, 59, 59, 999);
  }

  return { start, end, previousStart, previousEnd, dayEnds };
}

function trendPercent(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function buildAdminDashboardStats(
  prisma: PrismaClient,
  range: AdminDashboardDateRange,
  viewerRole: AdminRole
): Promise<AdminDashboardStatsData> {
  const { start, end, previousStart, previousEnd, dayEnds } = range;
  const currency = process.env.BOOKING_CURRENCY || 'USD';

  const openDisputesCount = (asOf: Date) =>
    Promise.all([
      prisma.booking.count({
        where: { extensionStatus: 'PENDING', updatedAt: { lte: asOf } },
      }),
      prisma.booking.count({
        where: {
          paymentStatus: 'FAILED',
          status: { in: ['PENDING', 'ACCEPTED', 'ACTIVE'] },
          updatedAt: { lte: asOf },
        },
      }),
    ]).then(([a, b]) => a + b);

  const grossRevenueSum = (from: Date, to: Date) =>
    prisma.booking
      .aggregate({
        where: { paymentStatus: 'PAID', createdAt: { gte: from, lte: to } },
        _sum: { grossAmount: true, totalAmount: true },
      })
      .then((agg) => agg._sum.grossAmount ?? agg._sum.totalAmount ?? 0);

  const [
    totalClients,
    totalClientsPrev,
    totalCompanions,
    totalCompanionsPrev,
    newSignups,
    newSignupsPrev,
    activeBookings,
    activeBookingsPrev,
    pendingVerifications,
    pendingVerificationsPrev,
    openDisputes,
    openDisputesPrev,
    grossRevenue,
    grossRevenuePrev,
    walletHeld,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: { in: [...CLIENT_ROLES] }, createdAt: { lte: end } },
    }),
    prisma.user.count({
      where: { role: { in: [...CLIENT_ROLES] }, createdAt: { lte: previousEnd } },
    }),
    prisma.companionProfile.count({ where: { user: { createdAt: { lte: end } } } }),
    prisma.companionProfile.count({ where: { user: { createdAt: { lte: previousEnd } } } }),
    prisma.user.count({
      where: { role: { in: [...CLIENT_ROLES] }, createdAt: { gte: start, lte: end } },
    }),
    prisma.user.count({
      where: {
        role: { in: [...CLIENT_ROLES] },
        createdAt: { gte: previousStart, lte: previousEnd },
      },
    }),
    prisma.booking.count({ where: { status: 'ACTIVE', startTime: { lte: end } } }),
    prisma.booking.count({ where: { status: 'ACTIVE', startTime: { lte: previousEnd } } }),
    prisma.companionProfile.count({ where: { trustRank: 'New' } }),
    prisma.companionProfile.count({
      where: { trustRank: 'New', user: { createdAt: { lte: previousEnd } } },
    }),
    openDisputesCount(end),
    openDisputesCount(previousEnd),
    grossRevenueSum(start, end),
    grossRevenueSum(previousStart, previousEnd),
    Promise.all([
      prisma.user.aggregate({ _sum: { walletBalance: true } }),
      prisma.companionProfile.aggregate({ _sum: { walletBalance: true } }),
    ]).then(([u, c]) => (u._sum.walletBalance ?? 0) + (c._sum.walletBalance ?? 0)),
  ]);

  const walletHeldPrev = walletHeld;

  const [
    sparkClients,
    sparkCompanions,
    sparkSignups,
    sparkRevenue,
    activeSparkline,
    verificationSparkline,
    disputesSparkline,
  ] = await Promise.all([
    Promise.all(
      dayEnds.map((d) =>
        prisma.user.count({
          where: { role: { in: [...CLIENT_ROLES] }, createdAt: { lte: d } },
        })
      )
    ),
    Promise.all(
      dayEnds.map((d) =>
        prisma.companionProfile.count({ where: { user: { createdAt: { lte: d } } } })
      )
    ),
    Promise.all(
      dayEnds.map((d) => {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        return prisma.user.count({
          where: {
            role: { in: [...CLIENT_ROLES] },
            createdAt: { gte: dayStart, lte: d },
          },
        });
      })
    ),
    Promise.all(
      dayEnds.map(async (d) => {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const sum = await grossRevenueSum(dayStart, d);
        return Math.round(sum * 100) / 100;
      })
    ),
    Promise.all(
      dayEnds.map((d) =>
        prisma.booking.count({ where: { status: 'ACTIVE', startTime: { lte: d } } })
      )
    ),
    Promise.all(
      dayEnds.map((d) =>
        prisma.companionProfile.count({
          where: { trustRank: 'New', user: { createdAt: { lte: d } } },
        })
      )
    ),
    Promise.all(dayEnds.map((d) => openDisputesCount(d))),
  ]);

  const walletSparkline = dayEnds.map(() => Math.round(walletHeld));

  const raw: Record<AdminDashboardStatCardKey, AdminDashboardMetricRaw> = {
    totalClients: {
      value: totalClients,
      trendPercent: trendPercent(totalClients, totalClientsPrev),
      sparkline: sparkClients,
    },
    totalCompanions: {
      value: totalCompanions,
      trendPercent: trendPercent(totalCompanions, totalCompanionsPrev),
      sparkline: sparkCompanions,
    },
    newSignups: {
      value: newSignups,
      trendPercent: trendPercent(newSignups, newSignupsPrev),
      sparkline: sparkSignups,
    },
    activeBookings: {
      value: activeBookings,
      trendPercent: trendPercent(activeBookings, activeBookingsPrev),
      sparkline: activeSparkline,
    },
    pendingVerifications: {
      value: pendingVerifications,
      trendPercent: trendPercent(pendingVerifications, pendingVerificationsPrev),
      sparkline: verificationSparkline,
    },
    openDisputes: {
      value: openDisputes,
      trendPercent: trendPercent(openDisputes, openDisputesPrev),
      sparkline: disputesSparkline,
    },
    grossRevenue: {
      value: grossRevenue,
      trendPercent: trendPercent(grossRevenue, grossRevenuePrev),
      sparkline: sparkRevenue,
    },
    walletBalanceHeld: {
      value: walletHeld,
      trendPercent: trendPercent(walletHeld, walletHeldPrev),
      sparkline: walletSparkline,
    },
  };

  const cards: AdminDashboardStatCard[] = ADMIN_DASHBOARD_CARDS_BY_ROLE[viewerRole].map((key) => {
    const meta = ADMIN_DASHBOARD_CARD_META[key];
    const { value, trendPercent: trend, sparkline } = raw[key];
    const rounded = meta.currency ? Math.round(value * 100) / 100 : value;
    return {
      key,
      label: meta.label,
      description: meta.description,
      value: rounded,
      ...(meta.currency
        ? {
            formattedValue: new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency,
              maximumFractionDigits: 0,
            }).format(value),
          }
        : {}),
      trendPercent: trend,
      sparkline,
    };
  });

  return {
    period: { startDate: start.toISOString(), endDate: end.toISOString() },
    viewerRole,
    cards,
  };
}
