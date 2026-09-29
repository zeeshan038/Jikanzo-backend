import { AdminRole } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../../config/db';
import {
  AdminDashboardTrendsData,
  AdminNeedsAttentionData,
  AdminNeedsAttentionItem,
  AdminTrustTierDistributionData,
  AdminTrustTierKey,
} from '../../types/adminDashboard';
import {
  buildAdminDashboardStats,
  parseAdminDashboardDateRange,
} from '../../utils/adminDashboard';

type AdminRequestUser = {
  admin: {
    id: number;
    email: string;
    name: string | null;
    role: string;
  };
};

function parseRangeFromQuery(req: Request) {
  return parseAdminDashboardDateRange({
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  });
}

/**
 * @Description Get admin dashboard KPI stats
 * @Route GET /api/admin/dashboard/stats
 * @Access Private (admin JWT)
 */
export const getStats = async (req: Request, res: Response): Promise<any> => {
  const { admin } = req.user as AdminRequestUser;
  if (!admin) {
    return res.status(401).json({ status: false, msg: 'Not authorized' });
  }

  try {
    const range = parseRangeFromQuery(req);

    const data = await buildAdminDashboardStats(
      prisma,
      range,
      admin.role as AdminRole
    );

    return res.status(200).json({
      status: true,
      msg: 'Dashboard stats fetched successfully',
      data,
    });
  } catch (error: any) {
    if (error?.message === 'Invalid startDate or endDate') {
      return res.status(400).json({ status: false, msg: error.message });
    }
    return res.status(500).json({
      status: false,
      msg: error?.message,
    });
  }
};

/**
 * @Description Booking and revenue trend (line chart)
 * @Route GET /api/admin/dashboard/booking-and-revenue-trend
 * @Access Private (admin JWT)
 */
export const getBookingAndRevenueTrend = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { admin } = req.user as AdminRequestUser;
  if (!admin) {
    return res.status(401).json({ status: false, msg: 'Not authorized' });
  }

  try {
    const range = parseRangeFromQuery(req);
    const { start, end, dayEnds } = range;

    const series = await Promise.all(
      dayEnds.map(async (dayEnd) => {
        const dayStart = new Date(dayEnd);
        dayStart.setHours(0, 0, 0, 0);

        const [bookings, agg] = await Promise.all([
          prisma.booking.count({
            where: { createdAt: { gte: dayStart, lte: dayEnd } },
          }),
          prisma.booking.aggregate({
            where: {
              paymentStatus: 'PAID',
              createdAt: { gte: dayStart, lte: dayEnd },
            },
            _sum: { grossAmount: true, totalAmount: true },
          }),
        ]);

        const revenueRaw = agg._sum.grossAmount ?? agg._sum.totalAmount ?? 0;

        return {
          date: dayStart.toISOString().slice(0, 10),
          bookings,
          revenue: Math.round(revenueRaw * 100) / 100,
        };
      })
    );

    const data: AdminDashboardTrendsData = {
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      series,
    };

    return res.status(200).json({
      status: true,
      msg: 'Booking and revenue trend fetched successfully',
      data,
    });
  } catch (error: any) {
    if (error?.message === 'Invalid startDate or endDate') {
      return res.status(400).json({ status: false, msg: error.message });
    }
    return res.status(500).json({
      status: false,
      msg: error?.message,
    });
  }
};

const TRUST_TIER_ORDER: AdminTrustTierKey[] = ['New', 'Verified', 'Trusted', 'Premium'];

/** Maps stored trustRank values to dashboard donut segments. */
const TRUST_RANK_TO_TIER: Record<string, AdminTrustTierKey> = {
  New: 'New',
  Verified: 'Verified',
  Trusted: 'Trusted',
  Premium: 'Premium',
  Elite: 'Premium',
};

/**
 * @Description Trust tier distribution (donut chart — all companions)
 * @Route GET /api/admin/dashboard/trust-tier
 * @Access Private (admin JWT)
 */
export const getTrustTierDistribution = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { admin } = req.user as AdminRequestUser;
  if (!admin) {
    return res.status(401).json({ status: false, msg: 'Not authorized' });
  }

  try {
    const grouped = await prisma.companionProfile.groupBy({
      by: ['trustRank'],
      _count: { id: true },
    });

    const counts: Record<AdminTrustTierKey, number> = {
      New: 0,
      Verified: 0,
      Trusted: 0,
      Premium: 0,
    };

    for (const row of grouped) {
      const tier = TRUST_RANK_TO_TIER[row.trustRank] ?? 'New';
      counts[tier] += row._count.id;
    }

    const totalCompanions = Object.values(counts).reduce((sum, n) => sum + n, 0);

    const segments = TRUST_TIER_ORDER.map((tier) => {
      const count = counts[tier];
      const percent =
        totalCompanions === 0
          ? 0
          : Math.round((count / totalCompanions) * 1000) / 10;
      return { tier, label: tier, count, percent };
    });

    const data: AdminTrustTierDistributionData = {
      totalCompanions,
      segments,
    };

    return res.status(200).json({
      status: true,
      msg: 'Trust tier distribution fetched successfully',
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      msg: error?.message,
    });
  }
};

/**
 * @Description Needs attention alerts (current operational queue)
 * @Route GET /api/admin/dashboard/needs-attention-list
 * @Access Private (admin JWT)
 */
export const getNeedsAttentionList = async (
  req: Request,
  res: Response
): Promise<any> => {
  const { admin } = req.user as AdminRequestUser;
  if (!admin) {
    return res.status(401).json({ status: false, msg: 'Not authorized' });
  }

  try {
    const [
      pendingVerification,
      disputesAwaitingDecision,
      refundRequestsPending,
      extensionPaymentFailed,
      trackingViolationsFlagged,
    ] = await Promise.all([
      prisma.companionProfile.count({ where: { trustRank: 'New' } }),
      prisma.booking.count({ where: { extensionStatus: 'PENDING' } }),
      prisma.booking.count({
        where: { status: 'CANCELLED', paymentStatus: 'PAID' },
      }),
      prisma.booking.count({
        where: {
          extensionPaymentStatus: 'FAILED',
          extensionStatus: { in: ['PENDING', 'ACCEPTED'] },
        },
      }),
      prisma.booking.count({ where: { paymentStatus: 'FAILED', status: 'ACTIVE' } }),
    ]);

    const refundCount = refundRequestsPending + extensionPaymentFailed;

    const items: AdminNeedsAttentionItem[] = [
      {
        key: 'pendingVerification',
        count: pendingVerification,
        title: `${pendingVerification} companions pending verification`,
        description: 'Applications are waiting for a manual review.',
        severity: 'warning',
        actionLabel: 'Open Verification',
      },
      {
        key: 'disputesAwaitingDecision',
        count: disputesAwaitingDecision,
        title: `${disputesAwaitingDecision} disputes awaiting decision`,
        description: 'Cases are waiting for an admin decision.',
        severity: 'warning',
        actionLabel: 'Open Disputes',
      },
      {
        key: 'refundRequestsPending',
        count: refundCount,
        title: `${refundCount} refund requests pending`,
        description: 'Requests are waiting to be approved or rejected.',
        severity: 'info',
        actionLabel: 'Open Refunds',
      },
      {
        key: 'trackingViolationsFlagged',
        count: trackingViolationsFlagged,
        title: `${trackingViolationsFlagged} tracking violations flagged`,
        description: 'Accounts frozen and payouts held.',
        severity: 'danger',
        actionLabel: 'Open Disputes',
      },
    ];

    const data: AdminNeedsAttentionData = {
      activeAlertCount: items.filter((item) => item.count > 0).length,
      items,
    };

    return res.status(200).json({
      status: true,
      msg: 'Needs attention list fetched successfully',
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      msg: error?.message,
    });
  }
};
