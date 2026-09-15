import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function wipe() {
  console.log("Wiping database...");
  await prisma.review.deleteMany({});
  await prisma.momentView.deleteMany({});
  await prisma.moment.deleteMany({});
  await prisma.feedStat.deleteMany({});
  await prisma.weeklySchedule.deleteMany({});
  await prisma.oneTimeAvailability.deleteMany({});
  await prisma.blockedDate.deleteMany({});
  await prisma.savedCompanion.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.companionProfile.deleteMany({});
  await prisma.user.deleteMany({});
  console.log("Database wiped!");
}

wipe().finally(() => prisma.$disconnect());
