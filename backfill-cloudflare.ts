import prisma from './src/config/db';
import { generateUniqueCloudflareId, ensureR2UserFolders } from './src/utils/cloudflare';

async function main() {
    console.log("Fetching users without a Cloudflare ID...");
    
    // Find all users who don't have a cloudflareId yet
    const usersWithoutId = await prisma.user.findMany({
        where: {
            OR: [
                { cloudflareId: null },
                { cloudflareId: '' }
            ]
        }
    });

    if (usersWithoutId.length === 0) {
        console.log("All users already have a Cloudflare ID. Nothing to do!");
        return;
    }

    console.log(`Found ${usersWithoutId.length} users to update.`);

    for (const user of usersWithoutId) {
        try {
            console.log(`Processing user ${user.username} (ID: ${user.id})...`);
            
            // 1. Generate unique ID
            const newCloudflareId = await generateUniqueCloudflareId();
            
            // 2. Update user in the database
            await prisma.user.update({
                where: { id: user.id },
                data: { cloudflareId: newCloudflareId }
            });
            console.log(`  -> Database updated with ID: ${newCloudflareId}`);

            // 3. Create R2 folders
            await ensureR2UserFolders(newCloudflareId);
            console.log(`  -> R2 Folders created!`);
            
        } catch (error) {
            console.error(`Failed to process user ${user.id}:`, error);
        }
    }

    console.log("Backfill complete!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
