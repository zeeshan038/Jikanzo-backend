import { Request, Response } from 'express';
import prisma from '../../config/db';
import { calculateDistance } from '../../utils/methods';

/**
 * @Description Create a Moment (Story)
 * @Route POST /api/moments/create
 * @Access Private (Companions only)
 */
export const createMoment = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;
    const { mediaUrl, caption } = req.body;

    if (!mediaUrl) {
        return res.status(400).json({ status: false, msg: "mediaUrl is required" });
    }

    try {
        const companion = await prisma.companionProfile.findUnique({
            where: { userId: Number(userId) }
        });

        if (!companion) {
            return res.status(403).json({ status: false, msg: "Only companions can create moments" });
        }

        // Moment expires 24 hours from now
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const moment = await prisma.moment.create({
            data: {
                companionId: companion.id,
                mediaUrl,
                caption,
                expiresAt
            }
        });

        return res.status(201).json({ status: true, msg: "Moment created successfully", data: moment });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Get Moments Feed (nearby or saved companions)
 * @Route GET /api/moments/feed?type=saved|nearby&lat=...&lng=...&radius=...
 * @Access Private
 */
export const getFeedMoments = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;
    const { type, lat, lng, radius } = req.query; // type can be 'saved' or 'nearby'

    try {
        const now = new Date();
        let companionIdsToFetch: number[] | null = null; // null means fetch all active, array means filter
        let userLat = Number(lat);
        let userLng = Number(lng);
        let searchRadius = Number(radius) || 50; // default 50km

        // If type is not explicitly 'nearby', default to 'saved'
        if (type !== 'nearby') {
            const savedCompanions = await prisma.savedCompanion.findMany({
                where: { userId: Number(userId) },
                select: { companionId: true }
            });

            companionIdsToFetch = savedCompanions.map(sc => sc.companionId);

            if (companionIdsToFetch.length === 0) {
                return res.status(200).json({ status: true, data: [] });
            }
        }

        // Fetch moments based on filters
        const whereClause: any = {
            expiresAt: { gt: now }
        };

        if (companionIdsToFetch !== null) {
            whereClause.companionId = { in: companionIdsToFetch };
        }

        let moments = await prisma.moment.findMany({
            where: whereClause,
            include: {
                companion: {
                    include: {
                        user: {
                            select: {
                                username: true,
                                profileImage: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Filter by nearby if requested
        if (type === 'nearby' && lat && lng) {
            moments = moments.filter(m => {
                const cLat = m.companion.locationLat;
                const cLng = m.companion.locationLng;
                
                if (cLat == null || cLng == null) return false;

                const distance = calculateDistance(userLat, userLng, cLat, cLng);
                return distance <= searchRadius;
            });
        }

        const formatted = moments.map(m => ({
            momentId: m.id,
            mediaUrl: m.mediaUrl,
            caption: m.caption,
            createdAt: m.createdAt,
            expiresAt: m.expiresAt,
            companion: {
                companionId: m.companionId,
                username: m.companion.user.username,
                profileImage: m.companion.user.profileImage
            }
        }));

        return res.status(200).json({ status: true, data: formatted });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Delete a Moment
 * @Route DELETE /api/moments/:id
 * @Access Private (Companion owner only)
 */
export const deleteMoment = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;
    const momentId = req.params.id;

    try {
        const companion = await prisma.companionProfile.findUnique({
            where: { userId: Number(userId) }
        });

        if (!companion) {
            return res.status(403).json({ status: false, msg: "Unauthorized" });
        }

        const moment = await prisma.moment.findUnique({
            where: { id: Number(momentId) }
        });

        if (!moment) {
            return res.status(404).json({ status: false, msg: "Moment not found" });
        }

        if (moment.companionId !== companion.id) {
            return res.status(403).json({ status: false, msg: "You do not own this moment" });
        }

        await prisma.moment.delete({
            where: { id: Number(momentId) }
        });

        return res.status(200).json({ status: true, msg: "Moment deleted successfully" });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Appreciate a Moment (Like, Diamond, Ring)
 * @Route POST /api/moments/:id/appreciate
 * @Access Private
 */
export const appreciateMoment = async (req: Request, res: Response): Promise<any> => {
    const momentId = req.params.id;
    const { type } = req.body; // 'like', 'diamond', or 'ring'

    if (!['like', 'diamond', 'ring'].includes(type)) {
        return res.status(400).json({ status: false, msg: "Invalid appreciation type" });
    }

    try {
        const moment = await prisma.moment.findUnique({
            where: { id: Number(momentId) }
        });

        if (!moment) {
            return res.status(404).json({ status: false, msg: "Moment not found" });
        }

        let updateData = {};
        if (type === 'like') updateData = { likes: { increment: 1 } };
        if (type === 'diamond') updateData = { diamonds: { increment: 1 } };
        if (type === 'ring') updateData = { rings: { increment: 1 } };

        const updated = await prisma.moment.update({
            where: { id: Number(momentId) },
            data: updateData
        });

        return res.status(200).json({ status: true, msg: `Appreciated with ${type}`, data: updated });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};
