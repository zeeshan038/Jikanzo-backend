import { Request, Response } from 'express';
import prisma from '../../config/db';

/**
 * @Description Get available activities
 * @Route GET /api/companion/activity/available
 * @Access Private
 */
export const getAvailableActivities = async (req: Request, res: Response) => {
    try {
        const activities = await prisma.activity.findMany({
            where: { isActive: true },
            include: {
                subActivities: {
                    where: { isActive: true }
                }
            }
        });
        res.status(200).json({ status: true, msg: "Available activities fetched successfully", data: activities });
    } catch (error: any) {
        console.error("Get Available Activities Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Get companion's selected activities
 * @Route GET /api/companion/activity
 * @Access Private
 */
export const getCompanionActivities = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        
        const profile = await prisma.companionProfile.findUnique({
            where: { userId }
        });

        if (!profile) {
            return res.status(404).json({ status: false, msg: "Companion profile not found" });
        }

        const activities = await prisma.companionActivity.findMany({
            where: { companionId: profile.id },
            include: {
                activity: true,
                subActivities: {
                    include: {
                        subActivity: true
                    }
                }
            }
        });
        res.status(200).json({ status: true, msg: "Companion activities fetched successfully", data: activities });
    } catch (error: any) {
        console.error("Get Companion Activities Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Update companion activities
 * @Route PUT /api/companion/activity
 * @Access Private
 */
export const setCompanionActivities = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { activities } = req.body; // Array of { activityId, price, isActive, subActivityIds }

        if (!activities || !Array.isArray(activities)) {
            return res.status(400).json({ status: false, msg: "Activities array is required" });
        }

        const profile = await prisma.companionProfile.findUnique({
            where: { userId }
        });

        if (!profile) {
            return res.status(404).json({ status: false, msg: "Companion profile not found" });
        }

        // Use a transaction to update
        await prisma.$transaction(async (tx) => {
            for (const act of activities) {
                const { activityId, price, isActive, subActivityIds } = act;
                
                if (!activityId) continue;

                // Upsert CompanionActivity
                const compActivity = await tx.companionActivity.upsert({
                    where: {
                        companionId_activityId: {
                            companionId: profile.id,
                            activityId: activityId
                        }
                    },
                    update: {
                        price: price ?? 0,
                        isActive: isActive ?? true
                    },
                    create: {
                        companionId: profile.id,
                        activityId,
                        price: price ?? 0,
                        isActive: isActive ?? true
                    }
                });

                // Clear old sub-activities
                await tx.companionSubActivity.deleteMany({
                    where: { companionActivityId: compActivity.id }
                });

                // Create new sub-activities if provided and if activity is active
                if (isActive && Array.isArray(subActivityIds) && subActivityIds.length > 0) {
                    const subData = subActivityIds.map((subId: number) => ({
                        companionActivityId: compActivity.id,
                        subActivityId: subId
                    }));
                    await tx.companionSubActivity.createMany({
                        data: subData
                    });
                }
            }
        });

        res.status(200).json({ status: true, msg: "Activities updated successfully" });
    } catch (error: any) {
        console.error("Set Companion Activities Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};
