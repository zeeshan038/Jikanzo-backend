import dotenv from 'dotenv';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
        return error.message;
    }
};
