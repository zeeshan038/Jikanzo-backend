import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import dotenv from 'dotenv';

dotenv.config();

try {
  if (process.env.FIREBASE_ADMIN_SDK_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON);
    
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully.");
  } else {
    console.warn("FIREBASE_ADMIN_SDK_JSON is not defined in .env. Firebase Admin not initialized.");
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

export default admin;
