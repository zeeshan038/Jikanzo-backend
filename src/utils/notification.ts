import prisma from "../config/db";
import admin from "../config/firebase";

export const sendPushNotification = async (userId: number, title: string, body: string, data: any = {}, type?: string) => {
  try {
    // 1. Create the notification in the database
    await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        data: Object.keys(data).length > 0 ? data : null,
        type: type || null
      }
    });

    // 2. Fetch the user's FCM token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true }
    });

    if (user && user.fcmToken) {
      // Format data payload (FCM only accepts string values for data)
      let fcmData: { [key: string]: string } | undefined = undefined;
      if (data && Object.keys(data).length > 0) {
        fcmData = {};
        for (const key of Object.keys(data)) {
          fcmData[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
        }
      }

      const message = {
        notification: {
          title,
          body
        },
        data: fcmData,
        token: user.fcmToken
      };

      const response = await admin.messaging().send(message);
      console.log(`[Push Notification Sent] -> User ID: ${userId}, Message ID: ${response}`);
    } else {
      console.log(`[Push Notification Skipped] -> User ID: ${userId} (No FCM Token found)`);
    }
  } catch (error) {
    console.error("[Push Notification Error]: Failed to save or send notification", error);
  }
};
