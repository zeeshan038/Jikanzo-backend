import cron from 'node-cron';
import prisma from '../config/db';

async function purgeExpiredMoments() {
  const result = await prisma.moment.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });

  if (result.count > 0) {
    console.log(`[CRON] Purged ${result.count} expired moment(s).`);
  }
}

// Every 15 minutes — stories are hidden at read time; this cleans DB and media refs
cron.schedule('*/15 * * * *', async () => {
  try {
    await purgeExpiredMoments();
  } catch (error) {
    console.error('[CRON] Error purging expired moments:', error);
  }
});
