import { Request, Response } from 'express';
import prismaClient from '../../config/db';
import {
    discoveryLocationForCompanion,
    haversineDistanceKm,
} from '../../utils/savedLocations';

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
                        savedLocations: true,
                    }
                }
            }
        });

        const companionsWithDistance = companions
            .map((companion) => {
                const activeLocation = discoveryLocationForCompanion(
                    companion.user.savedLocations,
                    companion.locationLat,
                    companion.locationLng,
                );
                if (!activeLocation) return null;

                const distance = haversineDistanceKm(
                    userLat,
                    userLng,
                    activeLocation.lat,
                    activeLocation.lng,
                );

                const activePin = {
                    lat: activeLocation.lat,
                    lng: activeLocation.lng,
                    ...(activeLocation.name ? { name: activeLocation.name } : {}),
                };

                return {
                    ...companion,
                    locationLat: activePin.lat,
                    locationLng: activePin.lng,
                    activeLocation: activePin,
                    distance,
                    distanceMeters: Math.round(distance * 1000),
                };
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)
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
