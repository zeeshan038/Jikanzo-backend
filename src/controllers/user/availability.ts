import { Request, Response } from 'express';
import prisma from '../../config/db';
import { 
    WeeklyScheduleSchema, 
    AvailabilitySettingsSchema, 
    OneTimeAvailabilitySchema, 
    BlockedDateSchema 
} from '../../schema/user/Availability';


/**
 * @Description Get Availability
 * @Route GET  /api/availability/get-availability
 * @Access Private
 */
export const getAvailability = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        
        const companion = await prisma.companionProfile.findUnique({
            where: { userId },
            include: {
                schedules: true,
                oneTimeAvailabilities: true,
                blockedDates: true
            }
        });

        if (!companion) {
            return res.status(404).json({ status: false, msg: "Companion profile not found" });
        }

        return res.status(200).json({
            status: true,
            msg: "Availability fetched successfully",
            data: {
                bookingBufferMin: companion.bookingBufferMin,
                isPaused: companion.isPaused,
                schedules: companion.schedules,
                oneTimeAvailabilities: companion.oneTimeAvailabilities,
                blockedDates: companion.blockedDates
            }
        });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};

/**
 * @Description Update Weekly Schedule
 * @Route PUT  /api/availability/weekly-schedule
 * @Access Private
 */
export const updateWeeklySchedule = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const payload = req.body; // Expects an array of 7 objects

        const result = WeeklyScheduleSchema.validate(payload);
        if (result.error) {
            return res.status(400).json({ status: false, msg: result.error.details.map(d => d.message).join(",") });
        }

        const companion = await prisma.companionProfile.findUnique({ where: { userId } });
        if (!companion) {
            return res.status(404).json({ status: false, msg: "Companion profile not found" });
        }

        // Upsert all 7 days
        const upsertPromises = payload.map((day: any) => 
            prisma.weeklySchedule.upsert({
                where: {
                    companionId_dayOfWeek: {
                        companionId: companion.id,
                        dayOfWeek: day.dayOfWeek
                    }
                },
                update: {
                    isAvailable: day.isAvailable,
                    startTime: day.startTime,
                    endTime: day.endTime
                },
                create: {
                    companionId: companion.id,
                    dayOfWeek: day.dayOfWeek,
                    isAvailable: day.isAvailable,
                    startTime: day.startTime,
                    endTime: day.endTime
                }
            })
        );

        await Promise.all(upsertPromises);

        return res.status(200).json({ status: true, msg: "Weekly schedule updated successfully" });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};


/**
 * @Description Update Availability Settings
 * @Route PUT  /api/availability/settings
 * @Access Private
 */
export const updateSettings = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const payload = req.body;

        const result = AvailabilitySettingsSchema.validate(payload);
        if (result.error) {
            return res.status(400).json({ status: false, msg: result.error.details.map(d => d.message).join(",") });
        }

        const companion = await prisma.companionProfile.findUnique({ where: { userId } });
        if (!companion) {
            return res.status(404).json({ status: false, msg: "Companion profile not found" });
        }

        await prisma.companionProfile.update({
            where: { id: companion.id },
            data: payload
        });

        return res.status(200).json({ status: true, msg: "Settings updated successfully" });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};


/**
 * @Description Add One-Time Availability
 * @Route POST  /api/availability/one-time
 * @Access Private
 */
export const addOneTimeAvailability = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const payload = req.body;

        const result = OneTimeAvailabilitySchema.validate(payload);
        if (result.error) {
            return res.status(400).json({ status: false, msg: result.error.details.map(d => d.message).join(",") });
        }

        const companion = await prisma.companionProfile.findUnique({ where: { userId } });
        if (!companion) {
            return res.status(404).json({ status: false, msg: "Companion profile not found" });
        }

        const newAvailability = await prisma.oneTimeAvailability.create({
            data: {
                companionId: companion.id,
                date: new Date(payload.date),
                startTime: payload.startTime,
                endTime: payload.endTime,
                location: payload.location
            }
        });

        return res.status(201).json({ status: true, msg: "One-time availability added", data: newAvailability });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};


/**
 * @Description Delete One-Time Availability
 * @Route DELETE  /api/availability/one-time/:id
 * @Access Private
 */
export const deleteOneTimeAvailability = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const companion = await prisma.companionProfile.findUnique({ where: { userId } });
        if (!companion) return res.status(404).json({ status: false, msg: "Companion profile not found" });

        await prisma.oneTimeAvailability.deleteMany({
            where: {
                id: Number(id),
                companionId: companion.id
            }
        });

        return res.status(200).json({ status: true, msg: "One-time availability removed" });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};


/**
 * @Description Add Blocked Date
 * @Route POST  /api/availability/blocked-date
 * @Access Private
 */
export const addBlockedDate = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const payload = req.body;

        const result = BlockedDateSchema.validate(payload);
        if (result.error) {
            return res.status(400).json({ status: false, msg: result.error.details.map(d => d.message).join(",") });
        }

        const companion = await prisma.companionProfile.findUnique({ where: { userId } });
        if (!companion) return res.status(404).json({ status: false, msg: "Companion profile not found" });

        const newBlockedDate = await prisma.blockedDate.create({
            data: {
                companionId: companion.id,
                startDate: new Date(payload.startDate),
                endDate: new Date(payload.endDate),
                reason: payload.reason
            }
        });

        return res.status(201).json({ status: true, msg: "Blocked date added", data: newBlockedDate });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};


/**
 * @Description Delete Blocked Date
 * @Route DELETE  /api/availability/blocked-date/:id
 * @Access Private
 */
export const deleteBlockedDate = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = (req as any).user.id;
        const { id } = req.params;

        const companion = await prisma.companionProfile.findUnique({ where: { userId } });
        if (!companion) return res.status(404).json({ status: false, msg: "Companion profile not found" });

        await prisma.blockedDate.deleteMany({
            where: {
                id: Number(id),
                companionId: companion.id
            }
        });

        return res.status(200).json({ status: true, msg: "Blocked date removed" });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};
