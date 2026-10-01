import prisma from "../config/db";
import { getMessaging } from "firebase-admin/messaging";

export type PushNotificationResult = {
  savedToDb: boolean;
  fcmSent: boolean;
  messageId?: string;
  skipReason?: string;
  error?: string;
};

export type FcmOnlyPushResult = {
  fcmSent: boolean;
  messageId?: string;
  skipReason?: string;
  error?: string;
};

function toFcmDataPayload(data: Record<string, unknown>): { [key: string]: string } | undefined {
  if (!data || Object.keys(data).length === 0) return undefined;
  const fcmData: { [key: string]: string } = {};
  for (const key of Object.keys(data)) {
    const value = data[key];
    fcmData[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return fcmData;
}

/** WhatsApp-style alert: FCM only, no in-app Notification row. */
export const sendFcmPushOnly = async (
  userId: number,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<FcmOnlyPushResult> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      console.log(`[FCM-only push skipped] User ID: ${userId} (no FCM token)`);
      return { fcmSent: false, skipReason: 'NO_FCM_TOKEN' };
    }

    const message = {
      notification: { title, body },
      data: toFcmDataPayload(data),
      token: user.fcmToken,
    };

    const response = await getMessaging().send(message);
    console.log(`[FCM-only push sent] User ID: ${userId}, Message ID: ${response}`);
    return { fcmSent: true, messageId: response };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send FCM push';
    console.error('[FCM-only push error]:', error);
    return { fcmSent: false, error: message };
  }
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
      const message = {
        notification: {
          title,
          body
        },
        data: toFcmDataPayload(data ?? {}),
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
