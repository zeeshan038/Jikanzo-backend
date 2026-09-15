export const sendPushNotification = async (userId: number, title: string, body: string, data: any = {}) => {
  // TODO: Implement actual push notification logic (e.g., Firebase Cloud Messaging, Expo, OneSignal)
  console.log(`[Push Notification] -> User ID: ${userId}`);
  console.log(`[Push Notification] -> Title: ${title}`);
  console.log(`[Push Notification] -> Body: ${body}`);
  if (Object.keys(data).length > 0) {
    console.log(`[Push Notification] -> Data:`, data);
  }
};
