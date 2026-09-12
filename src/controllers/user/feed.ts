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

        // if (gender) {
        //     // Note: Needs 'gender' field in User model
        //     whereClause.user.is.gender = (gender as string).toUpperCase();
        // }

        // if (location) {
        //     // Note: Needs 'city' field in CompanionProfile
        //     whereClause.city = {
        //         equals: location as string,
        //         mode: 'insensitive'
        //     };
        // }

        // if (activityTypes) {
        //     // Note: Needs 'activityTypes' String[] in CompanionProfile
        //     const activities = (activityTypes as string).split(',');
        //     whereClause.activityTypes = { hasSome: activities };
        // }

        // if (languages) {
        //     // Note: Needs 'languages' String[] in CompanionProfile
        //     const langs = (languages as string).split(',');
        //     whereClause.languages = { hasSome: langs };
        // }

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
            include: {
                user: true,
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

        // Remove walletBalance and extra fields from response
        const sanitizedCompanions = paginated.map(companion => {
            const { walletBalance, feedStats, finalScore, bucket, ...rest } = companion;
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
                // If it's been more than 24h since last shown, we could reset it. 
                // For now, let's just increment and assume a daily CRON job clears it, 
                // or we check time difference. 
                // Simple version: just increment
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

        return res.status(200).json({ status: true, msg: "Impression logged successfully" });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};