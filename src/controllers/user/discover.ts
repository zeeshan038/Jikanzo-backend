
import { Request, Response } from 'express';
import prismaClient from '../../config/db';

/***
 * @Description Discover people near you
 * @Route GET /api/discover/people
 * @Access Private
 */
export const discoverPeople = async (req: Request, res: Response) => {
    try {
        const { lat, lng, radius = 50 } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                status: false,
                msg: "Latitude and longitude are required."
            });
        }

        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);
        const searchRadius = parseFloat(radius as string);

        if (isNaN(userLat) || isNaN(userLng) || isNaN(searchRadius)) {
            return res.status(400).json({
                status: false,
                msg: "Invalid latitude, longitude, or radius."
            });
        }

        // Calculate bounding box for initial filter
        // 1 degree of latitude = ~111.045 km
        const latDelta = searchRadius / 111.045;
        const lngDelta = searchRadius / (111.045 * Math.cos(userLat * (Math.PI / 180)));



        // Fetch companions within bounding box
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
            include: {
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

        const companionsWithDistance = companions.map(companion => {
            const distance = calculateDistance(
                userLat, userLng,
                companion.locationLat as number, companion.locationLng as number
            );
            return {
                ...companion,
                distance
            };
        }).filter(c => c.distance <= searchRadius)
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