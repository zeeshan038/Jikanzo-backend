import { Request, Response } from 'express';
import prismaClient from '../../config/db';

/***
 * @Description Discover people near you
 * @Route GET /api/discover/people
 * @Access Private 
 */
const DEFAULT_RADIUS_METERS = 5000;
const MAX_RADIUS_METERS = 500_000;

export const discoverPeople = async (req: Request, res: Response) => {
    const { lat, lng, radius = DEFAULT_RADIUS_METERS } = req.query;
    try {
        if (!lat || !lng) {
            return res.status(400).json({
                status: false,
                msg: "Latitude and longitude are required."
            });
        }

        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);
        const radiusMeters = parseFloat(radius as string);

        if (isNaN(userLat) || isNaN(userLng) || isNaN(radiusMeters)) {
            return res.status(400).json({
                status: false,
                msg: "Invalid latitude, longitude, or radius."
            });
        }

        if (radiusMeters <= 0) {
            return res.status(400).json({
                status: false,
                msg: "Radius must be greater than 0.",
            });
        }

        const cappedRadiusMeters = Math.min(radiusMeters, MAX_RADIUS_METERS);
        const searchRadiusKm = cappedRadiusMeters / 1000;

        // Calculate bounding box for initial filter
        // 1 degree of latitude = ~111.045 km
        const latDelta = searchRadiusKm / 111.045;
        const lngDelta = searchRadiusKm / (111.045 * Math.cos(userLat * (Math.PI / 180)));



        // Fetch companions within bounding box (public fields only for discover UI)
        const companions = await prismaClient.companionProfile.findMany({
            where: {
                locationLat: {
                    gte: userLat - latDelta,
                    lte: userLat + latDelta,
                },
                locationLng: {
                    gte: userLng - lngDelta,
                    lte: userLng + lngDelta,
                }
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

        // Haversine formula to calculate exact distance
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
            const R = 6371; // Earth radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        const companionsWithDistance = companions.map((companion) => {
            const distance = calculateDistance(
                userLat, userLng,
                companion.locationLat as number, companion.locationLng as number
            );
            return {
                ...companion,
                distance: distance,
                distanceMeters: Math.round(distance * 1000),
            };
        })
            .filter((c) => c.distance <= searchRadiusKm)
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
}