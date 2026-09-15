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
    const { type, lat, lng, radius } = req.query;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    try {
        const now = new Date();
        let companionIdsToFetch: number[] | null = null; 
        let userLat = Number(lat);
        let userLng = Number(lng);
        let searchRadius = Number(radius) || 50; 

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
                views: {
                    where: { userId: Number(userId) },
                    select: { id: true }
                },
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

        // Group by companion
        const groupedMap = new Map<number, any>();

        for (const m of moments) {
            const compId = m.companionId;
            if (!groupedMap.has(compId)) {
                groupedMap.set(compId, {
                    companionId: compId,
                    username: m.companion.user.username,
                    profileImage: m.companion.user.profileImage,
                    allSeen: true,
                    moments: []
                });
            }

            const compData = groupedMap.get(compId);
            const isSeen = m.views.length > 0;
            
            if (!isSeen) {
                compData.allSeen = false;
            }

            compData.moments.push({
                momentId: m.id,
                mediaUrl: m.mediaUrl,
                caption: m.caption,
                likes: m.likes,
                diamonds: m.diamonds,
                rings: m.rings,
                createdAt: m.createdAt,
                expiresAt: m.expiresAt,
                isSeen
            });
        }

        const formatted = Array.from(groupedMap.values());

        // Apply pagination after grouping
        const total = formatted.length;
        const paginated = formatted.slice(skip, skip + limit);

        return res.status(200).json({ 
            status: true, 
            data: paginated,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
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

/**
 * @Description Mark a Moment as Seen
 * @Route POST /api/moments/:id/seen
 * @Access Private
 */
export const markMomentAsSeen = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;
    const momentId = req.params.id;

    try {
        const moment = await prisma.moment.findUnique({
            where: { id: Number(momentId) }
        });

        if (!moment) {
            return res.status(404).json({ status: false, msg: "Moment not found" });
        }

        // Upsert to ignore if it already exists (@@unique constraint)
        await prisma.momentView.upsert({
            where: {
                userId_momentId: {
                    userId: Number(userId),
                    momentId: Number(momentId)
                }
            },
            update: {},
            create: {
                userId: Number(userId),
                momentId: Number(momentId)
            }
        });

        return res.status(200).json({ status: true, msg: "Moment marked as seen" });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};



/**
 * @Description Companion can see all of his posted moments with likes 
 * @Route GET /api/moments/all
 * @Access Private
 */
export const getCompanionMoments = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    try {
        const companionProfile = await prisma.companionProfile.findFirst({
            where: { userId: Number(userId) }
        });

        if (!companionProfile) {
            return res.status(404).json({ status: false, msg: "Companion profile not found" });
        }

        const total = await prisma.moment.count({ where: { companionId: companionProfile.id } });

        const moments = await prisma.moment.findMany({
            where: { companionId: companionProfile.id },
            select: {
                id: true,
                mediaUrl: true,
                caption: true,
                likes: true,
                diamonds: true,
                rings: true,
                createdAt: true,
                expiresAt: true,
                _count: {
                    select: { views: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: skip
        });

        // Format to move _count.views to a flat viewCount property for convenience
        const formatted = moments.map(m => ({
            id: m.id,
            mediaUrl: m.mediaUrl,
            caption: m.caption,
            likes: m.likes,
            diamonds: m.diamonds,
            rings: m.rings,
            createdAt: m.createdAt,
            expiresAt: m.expiresAt,
            viewCount: m._count.views
        }));

        return res.status(200).json({ 
            status: true, 
            msg: "Moments fetched successfully", 
            data: formatted,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};