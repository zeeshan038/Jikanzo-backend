import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

function normalizePrivateKey(serviceAccount: Record<string, unknown>): void {
  const pk = serviceAccount.private_key;
  if (typeof pk === 'string') {
    serviceAccount.private_key = pk.replace(/\\n/g, '\n');
  }
}

function loadServiceAccount(): Record<string, unknown> | null {
  const filePath = process.env.FIREBASE_ADMIN_SDK_PATH;
  if (filePath) {
    const resolved = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    const raw = fs.readFileSync(resolved, 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  }

  const json = process.env.FIREBASE_ADMIN_SDK_JSON;
  if (json) {
    return JSON.parse(json) as Record<string, unknown>;
  }

  return null;
}

try {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    normalizePrivateKey(serviceAccount);
    initializeApp({
      credential: cert(serviceAccount as admin.ServiceAccount),
    });
    console.log('Firebase Admin initialized successfully.');
  } else {
    console.warn(
      'Firebase Admin credentials not configured (set FIREBASE_ADMIN_SDK_PATH or FIREBASE_ADMIN_SDK_JSON).'
    );
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
}

export default admin;
