import { Request, Response } from 'express';
import prisma from '../../config/db';


/**
 * @Description Get dashboard data
 * @Route GET /api/companion/dashboard
 * @Access Private
 */
export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;
  
  try {
    const profile = await prisma.companionProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      res.status(404).json({
        status: false,
        msg: 'Companion profile not found'
      });
      return;
    }

    // Get today's start and end date for queries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Fetch pending bookings (Booking Requests)
    const newRequests = await prisma.booking.findMany({
      where: {
        companionId: profile.id,
        status: 'PENDING',
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        client: {
          select: {
            id: true,
            username: true,
            profileImage: true,
          }
        }
      }
    });

    // 2. Today's schedule (by session startTime, aligned with booking list statuses)
    const todayBookings = await prisma.booking.findMany({
      where: {
        companionId: profile.id,
        startTime: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: ['PENDING', 'ACCEPTED', 'ACTIVE', 'COMPLETED'],
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      include: {
        client: {
          select: {
            id: true,
            username: true,
            profileImage: true,
          }
        }
      }
    });

    // 3. Active bookings count (all active bookings not just today, or maybe just today depending on UI, let's just do all active)
    const activeBookingsCount = await prisma.booking.count({
      where: {
        companionId: profile.id,
        status: 'ACTIVE',
      }
    });

    // 4. Fetch recent reviews
    const reviews = await prisma.review.findMany({
      where: {
        companionId: profile.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 3, // latest 3 reviews
      include: {
        client: {
          select: {
            id: true,
            username: true,
            profileImage: true,
          }
        }
      }
    });

    // 5. Fetch Profile Views Analytics
    const todayViews = await prisma.profileView.count({
      where: {
        companionId: profile.id,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    const recentViewersRecords = await prisma.profileView.findMany({
      where: { companionId: profile.id },
      orderBy: { createdAt: 'desc' },
      distinct: ['viewerId'],
      take: 3,
      include: {
        viewer: {
          select: { profileImage: true }
        }
      }
    });
    
    const recentViewers = recentViewersRecords.map(record => ({
      profileImage: record.viewer.profileImage
    }));

    // 6. Calculate repeat rate
    let repeatRate = 0;
    if (profile.totalSessions > 0) {
      repeatRate = Math.round((profile.repeatClients / profile.totalSessions) * 100);
    }

    const now = new Date();

    // 7. Moments: posted stories + appreciation totals (likes, rings, diamonds, views)
    const [momentTotals, activeMomentsCount, totalMomentViews, activeMoments] = await Promise.all([
      prisma.moment.aggregate({
        where: { companionId: profile.id },
        _sum: { likes: true, diamonds: true, rings: true },
        _count: { id: true },
      }),
      prisma.moment.count({
        where: { companionId: profile.id, expiresAt: { gt: now } },
      }),
      prisma.momentView.count({
        where: { moment: { companionId: profile.id } },
      }),
      prisma.moment.findMany({
        where: { companionId: profile.id, expiresAt: { gt: now } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          mediaUrl: true,
          caption: true,
          likes: true,
          diamonds: true,
          rings: true,
          createdAt: true,
          expiresAt: true,
          _count: { select: { views: true } },
        },
      }),
    ]);

    const totalLikes = momentTotals._sum.likes ?? 0;
    const totalRings = momentTotals._sum.rings ?? 0;
    const totalDiamonds = momentTotals._sum.diamonds ?? 0;

    res.status(200).json({
      status: true,
      data: {
        walletBalance: profile.walletBalance,
        newRequests: {
          count: newRequests.length,
          list: newRequests,
        },
        todayBookings: todayBookings,
        activeBookings: activeBookingsCount,
        profileViews: {
          total: profile.profileViews,
          today: todayViews,
          recentViewers: recentViewers
        },
        rating: profile.rating,
        trustRank: profile.trustRank,
        performances: {
          totalSessions: profile.totalSessions,
          repeatClients: profile.repeatClients,
          repeatRate: repeatRate,
        },
        momentsAnalytics: {
          totalViews: totalMomentViews,
          totalLikes,
          totalRings,
          totalDiamonds,
        },
        moments: {
          posted: {
            total: momentTotals._count.id,
            active: activeMomentsCount,
            list: activeMoments.map((m) => ({
              id: m.id,
              mediaUrl: m.mediaUrl,
              caption: m.caption,
              likes: m.likes,
              rings: m.rings,
              diamonds: m.diamonds,
              viewCount: m._count.views,
              createdAt: m.createdAt,
              expiresAt: m.expiresAt,
            })),
          },
          appreciations: {
            views: totalMomentViews,
            likes: totalLikes,
            rings: totalRings,
            diamonds: totalDiamonds,
            total: totalLikes + totalRings + totalDiamonds,
          },
        },
        reviews: reviews,
      },
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ 
      status: false, 
      msg: 'Internal server error' 
    });
  }
};
