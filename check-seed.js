const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSeededData() {
  try {
    const companions = await prisma.user.findMany({
      where: { role: 'COMPANION' },
      take: 2,
      include: { companionProfile: true }
    });
    console.log("Found", companions.length, "companions:");
    console.dir(companions, { depth: null });
  } catch (error) {
    console.error("Error checking seeded data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSeededData();
