import { Request, Response } from 'express';
import prisma from '../../config/db';

/**
 * @Description Create activity
 * @Route POST /api/admin/activity
 * @Access Private
 */
export const createActivity = async (req: Request, res: Response) => {
    try {
        const { name, description, image, isActive } = req.body;

        if (!name) {
            return res.status(400).json({ status: false, msg: "Name is required" });
        }

        const activity = await prisma.activity.create({
            data: {
                name,
                description,
                image,
                isActive: isActive ?? true
            }
        });
        res.status(201).json({ status: true, msg: "Activity created successfully", data: activity });
    } catch (error: any) {
        console.error("Create Activity Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Get all activities
 * @Route GET /api/admin/activity
 * @Access Private
 */
export const getActivities = async (req: Request, res: Response) => {
    try {
        const activities = await prisma.activity.findMany({
            include: {
                subActivities: true
            }
        });
        res.status(200).json({ status: true, msg: "Activities fetched successfully", data: activities });
    } catch (error: any) {
        console.error("Get Activities Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Update activity
 * @Route PUT /api/admin/activity/:id
 * @Access Private
 */
export const updateActivity = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, image, isActive } = req.body;
        
        if (!id) {
            return res.status(400).json({ status: false, msg: "Activity ID is required" });
        }

        const activity = await prisma.activity.update({
            where: { id: parseInt(id) },
            data: {
                name,
                description,
                image,
                isActive
            }
        });
        res.status(200).json({ status: true, msg: "Activity updated successfully", data: activity });
    } catch (error: any) {
        console.error("Update Activity Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Delete activity
 * @Route DELETE /api/admin/activity/:id
 * @Access Private
 */
export const deleteActivity = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ status: false, msg: "Activity ID is required" });
        }

        await prisma.activity.delete({
            where: { id: parseInt(id) }
        });
        res.status(200).json({ status: true, msg: "Activity deleted successfully" });
    } catch (error: any) {
        console.error("Delete Activity Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Create sub-activity
 * @Route POST /api/admin/sub-activity
 * @Access Private
 */
export const createSubActivity = async (req: Request, res: Response) => {
    try {
        const { activityId, name, description, isActive } = req.body;
        
        if (!activityId || !name) {
            return res.status(400).json({ status: false, msg: "Activity ID and name are required" });
        }

        const subActivity = await prisma.subActivity.create({
            data: {
                activityId: parseInt(activityId),
                name,
                description,
                isActive: isActive ?? true
            }
        });
        res.status(201).json({ status: true, msg: "Sub-activity created successfully", data: subActivity });
    } catch (error: any) {
        console.error("Create Sub-Activity Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Update sub-activity
 * @Route PUT /api/admin/sub-activity/:id
 * @Access Private
 */
export const updateSubActivity = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;
        
        if (!id) {
            return res.status(400).json({ status: false, msg: "Sub-activity ID is required" });
        }

        const subActivity = await prisma.subActivity.update({
            where: { id: parseInt(id) },
            data: {
                name,
                description,
                isActive
            }
        });
        res.status(200).json({ status: true, msg: "Sub-activity updated successfully", data: subActivity });
    } catch (error: any) {
        console.error("Update Sub-Activity Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};

/**
 * @Description Delete sub-activity
 * @Route DELETE /api/admin/sub-activity/:id
 * @Access Private
 */
export const deleteSubActivity = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({ status: false, msg: "Sub-activity ID is required" });
        }

        await prisma.subActivity.delete({
            where: { id: parseInt(id) }
        });
        res.status(200).json({ status: true, msg: "Sub-activity deleted successfully" });
    } catch (error: any) {
        console.error("Delete Sub-Activity Error:", error);
        res.status(500).json({ status: false, msg: error.message || "Server error" });
    }
};