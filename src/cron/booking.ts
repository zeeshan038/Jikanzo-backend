import cron from 'node-cron';
import prisma from '../config/db';
import { BOOKING_REQUEST_EXPIRY_MS } from '../utils/bookingHelpers';
import { emitBookingRequestExpired } from '../sockets';

// Run every minute to check for expired booking requests
cron.schedule('* * * * *', async () => {
    try {
        const cutoff = new Date(Date.now() - BOOKING_REQUEST_EXPIRY_MS);

        const stale = await prisma.booking.findMany({
            where: {
                status: 'PENDING',
                createdAt: {
                    lt: cutoff,
                },
            },
            select: {
                id: true,
                clientId: true,
                companionId: true,
            },
        });

        if (stale.length === 0) {
            return;
        }

        await prisma.booking.updateMany({
            where: {
                id: { in: stale.map((b) => b.id) },
            },
            data: {
                status: 'CANCELLED',
                cancellationReason: 'Automatically cancelled after 30 minutes of no response.',
            },
        });

        console.log(`[CRON] Automatically expired ${stale.length} booking requests.`);

        for (const booking of stale) {
            emitBookingRequestExpired(booking.id, booking.companionId, booking.clientId).catch((err) =>
                console.error('[CRON] Socket emit expired:', err)
            );
        }
    } catch (error) {
        console.error('[CRON] Error expiring bookings:', error);
    }
});
