import prisma from "../config/db";
import { getMessaging } from "firebase-admin/messaging";

export type PushNotificationResult = {
  savedToDb: boolean;
  fcmSent: boolean;
  messageId?: string;
  skipReason?: string;
  error?: string;
};

export const sendPushNotification = async (
  userId: number,
  title: string,
  body: string,
  data: any = {},
  type?: string
): Promise<PushNotificationResult> => {
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

      const response = await getMessaging().send(message);
      console.log(`[Push Notification Sent] -> User ID: ${userId}, Message ID: ${response}`);
      return { savedToDb: true, fcmSent: true, messageId: response };
    }

    console.log(`[Push Notification Skipped] -> User ID: ${userId} (No FCM Token found)`);
    return { savedToDb: true, fcmSent: false, skipReason: "NO_FCM_TOKEN" };
  } catch (error: any) {
    console.error("[Push Notification Error]: Failed to save or send notification", error);
    return {
      savedToDb: false,
      fcmSent: false,
      error: error?.message || "Failed to send push notification",
    };
  }
};
