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
    // Fetch the companion profile for te logged in user
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

    // 2. Fetch today's bookings
    const todayBookings = await prisma.booking.findMany({
      where: {
        companionId: profile.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: ['PENDING', 'ACTIVE'],
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

    // 5. Calculate repeat rate
    let repeatRate = 0;
    if (profile.totalSessions > 0) {
      repeatRate = Math.round((profile.repeatClients / profile.totalSessions) * 100);
    }

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
        profileViews: profile.profileViews,
        rating: profile.rating,
        trustRank: profile.trustRank,
        performances: {
          totalSessions: profile.totalSessions,
          repeatClients: profile.repeatClients,
          repeatRate: repeatRate,
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
