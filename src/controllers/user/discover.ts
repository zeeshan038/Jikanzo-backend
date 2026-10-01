import { Request, Response } from 'express';
import prismaClient from '../../config/db';

/***
 * @Description Discover people near you (sorted by distance; no radius limit)
 * @Route GET /api/discover/people
 * @Access Private
 */
export const discoverPeople = async (req: Request, res: Response) => {
    const { lat, lng } = req.query;
    try {
        if (!lat || !lng) {
            return res.status(400).json({
                status: false,
                msg: "Latitude and longitude are required."
            });
        }

        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);

        if (isNaN(userLat) || isNaN(userLng)) {
            return res.status(400).json({
                status: false,
                msg: "Invalid latitude or longitude."
            });
        }

        const companions = await prismaClient.companionProfile.findMany({
            where: {
                locationLat: { not: null },
                locationLng: { not: null },
            },
            select: {
                id: true,
                bio: true,
                hourlyRate: true,
                locationLat: true,
                locationLng: true,
                serviceRadius: true,
                isOnline: true,
                profileViews: true,
                rating: true,
                trustRank: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        profileImage: true,
                        gender: true,
                        age: true,
                        about: true,
                    }
                }
            }
        });

        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const companionsWithDistance = companions
            .map((companion) => {
                const distance = calculateDistance(
                    userLat, userLng,
                    companion.locationLat as number, companion.locationLng as number
                );
                return {
                    ...companion,
                    distance,
                    distanceMeters: Math.round(distance * 1000),
                };
            })
            .sort((a, b) => a.distance - b.distance);

        return res.status(200).json({
            status: true,
            msg: "People discovered successfully",
            data: companionsWithDistance
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};
