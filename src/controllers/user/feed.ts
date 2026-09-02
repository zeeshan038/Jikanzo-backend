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

        const companions = await prisma.companionProfile.findMany({
            where: whereClause,
            include: {
                user: true
            },
            take: Number(limit),
            skip: Number(offset)
        });

        // Remove walletBalance from response
        const sanitizedCompanions = companions.map(companion => {
            const { walletBalance, ...rest } = companion;
            return rest;
        });

        return res.status(200).json({
            status: true,
            msg: "Companions fetched successfully",
            data: sanitizedCompanions
        })
    } catch (error: any) {
        res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};