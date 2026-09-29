import { AdminRole } from '@prisma/client';

export type AdminDashboardStatCardKey =
  | 'totalClients'
  | 'totalCompanions'
  | 'newSignups'
  | 'activeBookings'
  | 'pendingVerifications'
  | 'openDisputes'
  | 'grossRevenue'
  | 'walletBalanceHeld';

export type AdminDashboardCardMeta = {
  label: string;
  description: string;
  currency?: boolean;
};

export type AdminDashboardStatCard = {
  key: AdminDashboardStatCardKey;
  label: string;
  description: string;
  value: number;
  formattedValue?: string;
  trendPercent: number;
  sparkline: number[];
};

export type AdminDashboardPeriod = {
  startDate: string;
  endDate: string;
};

export type AdminDashboardStatsData = {
  period: AdminDashboardPeriod;
  viewerRole: AdminRole;
  cards: AdminDashboardStatCard[];
};

export type AdminDashboardTrendPoint = {
  date: string;
  bookings: number;
  revenue: number;
};

export type AdminDashboardTrendsData = {
  period: AdminDashboardPeriod;
  series: AdminDashboardTrendPoint[];
};

export type AdminTrustTierKey = 'New' | 'Verified' | 'Trusted' | 'Premium';

export type AdminTrustTierSegment = {
  tier: AdminTrustTierKey;
  label: string;
  count: number;
  percent: number;
};

export type AdminTrustTierDistributionData = {
  totalCompanions: number;
  segments: AdminTrustTierSegment[];
};

export type AdminNeedsAttentionSeverity = 'warning' | 'info' | 'danger';

export type AdminNeedsAttentionKey =
  | 'pendingVerification'
  | 'disputesAwaitingDecision'
  | 'refundRequestsPending'
  | 'trackingViolationsFlagged';

export type AdminNeedsAttentionItem = {
  key: AdminNeedsAttentionKey;
  count: number;
  title: string;
  description: string;
  severity: AdminNeedsAttentionSeverity;
  actionLabel: string;
};

export type AdminNeedsAttentionData = {
  /** Number of alert cards with count > 0 (badge on section header). */
  activeAlertCount: number;
  items: AdminNeedsAttentionItem[];
};

export type AdminDashboardMetricRaw = {
  value: number;
  trendPercent: number;
  sparkline: number[];
};

/** Parsed query range for dashboard queries (current + previous period + sparkline days). */
export type AdminDashboardDateRange = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  dayEnds: Date[];
};

export const ADMIN_DASHBOARD_CARD_META: Record<
  AdminDashboardStatCardKey,
  AdminDashboardCardMeta
> = {
  totalClients: { label: 'Total Clients', description: 'All registered clients.' },
  totalCompanions: { label: 'Total Companions', description: 'Active companion profiles.' },
  newSignups: { label: 'New Signups', description: 'Clients joined this period.' },
  activeBookings: { label: 'Active Bookings', description: 'Currently active.' },
  pendingVerifications: {
    label: 'Pending Verifications',
    description: 'Companion profiles awaiting review.',
  },
  openDisputes: { label: 'Open Disputes', description: 'Bookings needing attention.' },
  grossRevenue: {
    label: 'Gross Revenue',
    description: 'Total earnings (this period).',
    currency: true,
  },
  walletBalanceHeld: {
    label: 'Wallet Balance Held',
    description: 'In secure escrow.',
    currency: true,
  },
};

export const ADMIN_DASHBOARD_CARDS_BY_ROLE: Record<AdminRole, AdminDashboardStatCardKey[]> = {
  SUPER_ADMIN: Object.keys(ADMIN_DASHBOARD_CARD_META) as AdminDashboardStatCardKey[],
  ADMIN: Object.keys(ADMIN_DASHBOARD_CARD_META) as AdminDashboardStatCardKey[],
  MODERATOR: [
    'pendingVerifications',
    'openDisputes',
    'activeBookings',
    'newSignups',
    'totalClients',
    'totalCompanions',
  ],
  SUPPORT: ['activeBookings', 'pendingVerifications', 'openDisputes', 'newSignups'],
};
