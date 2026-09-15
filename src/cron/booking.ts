import cron from 'node-cron';
import prisma from '../config/db';

// Run every minute to check for expired booking requests
cron.schedule('* * * * *', async () => {
    try {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

        // Find and update pending bookings older than 30 minutes
        const expiredBookings = await prisma.booking.updateMany({
            where: {
                status: 'PENDING',
                createdAt: {
                    lt: thirtyMinsAgo,
                },
            },
            data: {
                status: 'CANCELLED',
                cancellationReason: 'Automatically cancelled after 30 minutes of no response.',
            },
        });

        if (expiredBookings.count > 0) {
            console.log(`[CRON] Automatically expired ${expiredBookings.count} booking requests.`);
        }
    } catch (error) {
        console.error('[CRON] Error expiring bookings:', error);
    }
});
