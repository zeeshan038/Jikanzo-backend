import prisma from "../config/db";

export const sendPushNotification = async (userId: number, title: string, body: string, data: any = {}) => {
  try {
    // 1. Create the notification in the database
    await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        data: Object.keys(data).length > 0 ? data : null
      }
    });

    // 2. TODO: Implement actual push notification logic (e.g., Firebase Cloud Messaging, Expo, OneSignal)
    console.log(`[Push Notification] -> User ID: ${userId}`);
    console.log(`[Push Notification] -> Title: ${title}`);
    console.log(`[Push Notification] -> Body: ${body}`);
    if (Object.keys(data).length > 0) {
      console.log(`[Push Notification] -> Data:`, data);
    }
  } catch (error) {
    console.error("[Push Notification Error]: Failed to save or send notification", error);
  }
};
