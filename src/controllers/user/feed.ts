import { Request, Response } from "express";
import prisma from "../../config/db";


/**
 * @Description Get all of the companions 
 * @Route GET /api/feed/all?search=&offset=&limit=&sortby=relevance&gender=male&minrating=0&maxhourlyrate=0&maxdistance=10
 * @Access Private
 */
export const getCompanionsFeed = async (req: Request, res: Response) => {
    const {
        search,
        gender,
        location,
        activityTypes,
        languages,
        trustRank,
        rating,
        minPrice,
        maxPrice,
        limit = 10,
        offset = 0
    } = req.query;


    try {

        // Build the where clause dynamically
        const whereClause: any = {
            user: {
                is: {
                    role: 'COMPANION'
                }
            }
        };

        if (search) {
            whereClause.user.is.username = {
                contains: search as string,
                mode: 'insensitive'
            };
        }

        if (gender) {
            whereClause.user.is.gender = {
                equals: gender as string,
                mode: 'insensitive'
            };
        }

        // if (location) {
        //     // Note: Needs 'city' field in CompanionProfile (currently only has locationLat/Lng)
        // }

        if (activityTypes) {
            const activities = (activityTypes as string).split(',');
            whereClause.user.is.activityType = { hasSome: activities };
        }

        if (languages) {
            const langs = (languages as string).split(',');
            whereClause.user.is.languages = { hasSome: langs };
        }

        if (trustRank) {
            const ranks = (trustRank as string).split(',');
            whereClause.trustRank = { in: ranks };
        }

        if (rating) {
            whereClause.rating = { gte: parseFloat(rating as string) };
        }

        if (minPrice || maxPrice) {
            whereClause.hourlyRate = {};
            if (minPrice) whereClause.hourlyRate.gte = parseFloat(minPrice as string);
            if (maxPrice) whereClause.hourlyRate.lte = parseFloat(maxPrice as string);
        }

        const currentUserId = (req as any).user?.id;

        // Fetch a pool of candidates (e.g. up to 100) to sort in memory
        // A full production system might use Elasticsearch or Redis for this
        const candidates = await prisma.companionProfile.findMany({
            where: whereClause,
            select: {
                id: true,
                userId: true,
                bio: true,
                jssScore: true,
                completedMeetups: true,
                locationLat: true,
                locationLng: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        profileImage: true
                    }
                },
                ...(currentUserId ? { feedStats: { where: { userId: Number(currentUserId) } } } : {})
            },
            take: 100, // Fetch top 100 matching filters to rank
        });

        // 1. Calculate dynamic score for each candidate
        const scoredCandidates = candidates.map(companion => {
            const stat = companion.feedStats?.[0];
            const impressionsLast24h = stat ? stat.impressionsLast24h : 0;
            const jss = companion.jssScore || 0;
            const completedMeetups = companion.completedMeetups || 0;

            let finalScore = jss * 0.20; // Base Quality

            // Repeat Exposure Penalty (-2 points per impression)
            finalScore -= (impressionsLast24h * 2);

            // Freshness Boost for new companions
            if (completedMeetups < 3) {
                finalScore += 10;
            } else if (impressionsLast24h === 0) {
                finalScore += 5; // Not shown recently
            }

            // Random Jitter (-5 to +5)
            finalScore += (Math.random() * 10 - 5);

            let bucket = "GOOD";
            if (completedMeetups < 3 || impressionsLast24h === 0) {
                bucket = "NEW";
            } else if (finalScore > 75) { // Assuming JSS is out of 100, max base is 20. Wait, if JSS is out of 100, jss*0.20 max is 20. 
                // Adjusting threshold: if JSS is 100, score is 20. Let's say top is > 15
                bucket = finalScore > 15 ? "TOP" : "GOOD";
            }

            return { ...companion, finalScore, bucket };
        });

        // 2. Separate into buckets
        const topBucket = scoredCandidates.filter(c => c.bucket === "TOP").sort((a, b) => b.finalScore - a.finalScore);
        const goodBucket = scoredCandidates.filter(c => c.bucket === "GOOD").sort((a, b) => b.finalScore - a.finalScore);
        const newBucket = scoredCandidates.filter(c => c.bucket === "NEW").sort((a, b) => b.finalScore - a.finalScore);

        // 3. Interleave (2 Top, 2 Good, 1 New)
        const interleaved: typeof scoredCandidates = [];
        let tIdx = 0, gIdx = 0, nIdx = 0;

        while (tIdx < topBucket.length || gIdx < goodBucket.length || nIdx < newBucket.length) {
            // Take 2 Top
            for (let i = 0; i < 2 && tIdx < topBucket.length; i++) interleaved.push(topBucket[tIdx++]);
            // Take 2 Good
            for (let i = 0; i < 2 && gIdx < goodBucket.length; i++) interleaved.push(goodBucket[gIdx++]);
            // Take 1 New
            if (nIdx < newBucket.length) interleaved.push(newBucket[nIdx++]);
        }

        // Apply Pagination
        const paginated = interleaved.slice(Number(offset), Number(offset) + Number(limit));

        // Remove extra fields from response
        const sanitizedCompanions = paginated.map((companion: any) => {
            const { feedStats, finalScore, bucket, jssScore, completedMeetups, ...rest } = companion;
            return rest;
        });

        return res.status(200).json({
            status: true,
            msg: "Companions fetched successfully",
            data: sanitizedCompanions
        });
    } catch (error: any) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Specific Companion
 * @Route GET /api/feed/specific/:userId
 * @Access Private
 */
export const specificCompanion = async (req: Request, res: Response): Promise<any> => {
    try {
        const { userId } = req.params;
        const currentUserId = (req as any).user.id;

        const companion = await prisma.companionProfile.findUnique({
            where: { userId: Number(userId) },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        profileImage: true,
                        age: true,
                        gender: true,
                        about: true,
                        languages: true,
                        activityType: true,
                        gallery: true,
                        intros: true
                    }
                },
                reviews: {
                    include: {
                        client: {
                            select: {
                                id: true,
                                username: true,
                                profileImage: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                },
                moments: true,
                savedBy: {
                    where: { userId: currentUserId }
                }
            }
        });

        if (!companion) {
            return res.status(404).json({ status: false, msg: "Companion not found" });
        }

        // Calculate Moments Analytics
        let totalLikes = 0;
        let totalRings = 0;
        let totalDiamonds = 0;

        companion.moments.forEach(m => {
            totalLikes += m.likes || 0;
            totalRings += m.rings || 0;
            totalDiamonds += m.diamonds || 0;
        });

        // Calculate Performance Stats
        const totalSessions = companion.totalSessions || 0;
        const repeatClients = companion.repeatClients || 0;
        const repeatRate = totalSessions > 0 ? Math.round((repeatClients / totalSessions) * 100) : 0;

        // Determine if saved
        const isSaved = companion.savedBy && companion.savedBy.length > 0;

        // Clean up the response
        const { moments, savedBy, ...companionData } = companion;

        const responseData = {
            ...companionData,
            isSaved,
            momentsAnalytics: {
                totalLikes,
                totalRings,
                totalDiamonds
            },
            performance: {
                rating: companionData.rating,
                totalSessions,
                repeatClients,
                repeatRate: `${repeatRate}%`
            }
        };

        return res.status(200).json({
            status: true,
            msg: "Companion fetched successfully",
            data: responseData
        });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Toggle Save Companion
 * @Route POST /api/feed/save-companion
 * @Access Private
 */
export const saveCompanion = async (req: Request, res: Response): Promise<any> => {
    const currentUserId = (req as any).user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
        return res.status(400).json({ status: false, msg: "targetUserId is required" });
    }

    try {
        // Find the companion profile using the target user's ID
        const companion = await prisma.companionProfile.findUnique({
            where: { userId: Number(targetUserId) }
        });

        if (!companion) {
            return res.status(404).json({ status: false, msg: "Companion profile not found for this user" });
        }

        const existingSave = await prisma.savedCompanion.findUnique({
            where: {
                userId_companionId: {
                    userId: Number(currentUserId),
                    companionId: companion.id
                }
            }
        });

        if (existingSave) {
            // Unsave
            await prisma.savedCompanion.delete({
                where: { id: existingSave.id }
            });
            return res.status(200).json({ status: true, msg: "Companion unsaved successfully", isSaved: false });
        } else {
            // Save
            await prisma.savedCompanion.create({
                data: {
                    userId: Number(currentUserId),
                    companionId: companion.id
                }
            });
            return res.status(200).json({ status: true, msg: "Companion saved successfully", isSaved: true });
        }
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Get Saved Companions
 * @Route GET /api/feed/saved-companions
 * @Access Private
 */
export const getSavedCompanions = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;

    try {
        const saved = await prisma.savedCompanion.findMany({
            where: { userId: Number(userId) },
            include: {
                companion: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                profileImage: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = saved.map((s: any) => ({
            savedId: s.id,
            companionId: s.companion.id,
            userId: s.companion.user.id,
            username: s.companion.user.username,
            profileImage: s.companion.user.profileImage,
            isOnline: s.companion.isOnline,
            rating: s.companion.rating,
            hourlyRate: s.companion.hourlyRate,
            savedAt: s.createdAt
        }));

        return res.status(200).json({ status: true, data: formatted });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Log impression of a companion card
 * @Route POST /api/feed/impression
 * @Access Private
 */
export const logImpression = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;
    const { companionId, inTop3 } = req.body;

    if (!companionId) {
        return res.status(400).json({ status: false, msg: "companionId is required" });
    }

    try {
        await prisma.$transaction(async (tx) => {
            const stat = await tx.feedStat.findUnique({
                where: {
                    userId_companionId: {
                        userId: Number(userId),
                        companionId: Number(companionId)
                    }
                }
            });

            const top3Inc = inTop3 ? 1 : 0;

            if (stat) {
                await tx.feedStat.update({
                    where: { id: stat.id },
                    data: {
                        impressionsLast24h: { increment: 1 },
                        top3AppearancesLast24h: { increment: top3Inc },
                        lastShownAt: new Date()
                    }
                });
            } else {
                await tx.feedStat.create({
                    data: {
                        userId: Number(userId),
                        companionId: Number(companionId),
                        impressionsLast24h: 1,
                        top3AppearancesLast24h: top3Inc,
                        lastShownAt: new Date()
                    }
                });
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Impression logged successfully"
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Bulk Log impressions of multiple companion cards
 * @Route POST /api/feed/impression/bulk
 * @Access Private
 */
export const logImpressionBulk = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user.id;
    const { impressions } = req.body;

    if (!impressions || !Array.isArray(impressions) || impressions.length === 0) {
        return res.status(400).json({ status: false, msg: "impressions array is required" });
    }

    try {
        await prisma.$transaction(async (tx) => {

            const companionIds = impressions.map((imp: any) => Number(imp.companionId));

            const existingStats = await tx.feedStat.findMany({
                where: {
                    userId: Number(userId),
                    companionId: { in: companionIds }
                }
            });

            const existingMap = new Map(existingStats.map(s => [s.companionId, s]));

            for (const imp of impressions) {
                const compId = Number(imp.companionId);
                const stat = existingMap.get(compId);
                const top3Inc = imp.inTop3 ? 1 : 0;

                if (stat) {
                    await tx.feedStat.update({
                        where: { id: stat.id },
                        data: {
                            impressionsLast24h: { increment: 1 },
                            top3AppearancesLast24h: { increment: top3Inc },
                            lastShownAt: new Date()
                        }
                    });
                } else {
                    await tx.feedStat.create({
                        data: {
                            userId: Number(userId),
                            companionId: compId,
                            impressionsLast24h: 1,
                            top3AppearancesLast24h: top3Inc,
                            lastShownAt: new Date()
                        }
                    });
                }
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Bulk impressions logged successfully"
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};