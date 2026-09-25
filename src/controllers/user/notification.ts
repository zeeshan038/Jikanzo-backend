import { Request, Response } from "express";
import prisma from "../../config/db";

/**
 * @Description Get user's notification history
 * @Route GET /api/notification
 * @Access Private
 */
export const getNotifications = async (req: Request, res: Response) => {
  const { id: userId } = (req as any).user;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      status: true,
      msg: "Notifications fetched successfully",
      data: notifications
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};

/**
 * @Description Mark a notification as read (or all if id is 'all')
 * @Route POST /api/notification/:id/read
 * @Access Private
 */
export const markAsRead = async (req: Request, res: Response) => {
  const { id: userId } = (req as any).user;
  const { id } = req.params;

  try {
    if (id === 'all') {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
      });

      return res.status(200).json({
        status: true,
        msg: "All notifications marked as read"
      });
    }

    const notificationId = parseInt(id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ status: false, msg: "Invalid notification ID" });
    }

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId }
    });

    if (!notification) {
      return res.status(404).json({ status: false, msg: "Notification not found" });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    return res.status(200).json({
      status: true,
      msg: "Notification marked as read",
      data: updatedNotification
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};


/**
 * @Description Delete Notification
 * @Route DELETE /api/notification/delete/:id
 * @Access Private
 */
export const deleteNotifications = async (req: Request, res: Response) => {
  const { id: userId } = (req as any).user;
  const { id } = req.params;

  try {
    const notificationId = parseInt(id, 10);
    if (Number.isNaN(notificationId)) {
      return res.status(400).json({ status: false, msg: "Invalid notification ID" });
    }

    const deleted = await prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ status: false, msg: "Notification not found" });
    }

    return res.status(200).json({
      status: true,
      msg: "Notification deleted successfully",
      data: { id: notificationId },
    });
  } catch (error: any) {
    return res.status(500).json({
      status: false,
      msg: error.message,
    });
  }
};