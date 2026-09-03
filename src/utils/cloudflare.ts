import dotenv from 'dotenv';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../config/db';

dotenv.config();

export const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.CLOUDFLARE_SECRET_ACCESS_KEY || '',
    },
});

export const uploadToCloudflare = async (fileBuffer: Buffer, mimetype: string, originalName: string) => {
    try {
        const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || '';
        const publicUrl = process.env.CLOUDFLARE_PUBLIC_URL || '';

        // Generate a unique filename
        const ext = originalName.split('.').pop();
        const uniqueFilename = `${crypto.randomBytes(16).toString('hex')}-${Date.now()}.${ext}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: uniqueFilename,
            Body: fileBuffer,
            ContentType: mimetype,
        });

        await s3.send(command);

        const formattedBaseUrl = publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`;

        return `${formattedBaseUrl}${uniqueFilename}`;
    } catch (error: any) {
        console.error("Cloudflare upload error:", error);
        throw new Error(error.message);
    }
};

/**
 * Generate a unique 12-character ID for a user's Cloudflare folder.
 */
export async function generateUniqueCloudflareId(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
        const id = crypto.randomBytes(6).toString('hex');
        const exists = await prisma.user.findUnique({
            where: { cloudflareId: id }
        });
        if (!exists) return id;
    }
    throw new Error("Could not allocate unique cloudflareId");
}

/**
 * Create logical R2 folders for a user by uploading empty .keep files.
 * @param cloudflareId The user's unique Cloudflare ID
 */
export async function ensureR2UserFolders(cloudflareId: string) {
    if (!cloudflareId) return;

    const bucketName = process.env.CLOUDFLARE_BUCKET_NAME || '';
    
    // Base path: users/{cloudflareId}
    const basePath = `users/${cloudflareId}`;

    const createKeepFile = async (folderPath: string) => {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: `${folderPath}/.keep`,
            Body: '',
            ContentType: 'text/plain',
        });
        await s3.send(command);
    };

    await Promise.all([
        createKeepFile(`${basePath}/profile-picture`),
        createKeepFile(`${basePath}/moments`),
        createKeepFile(`${basePath}/verification-assets`),
    ]);
}
