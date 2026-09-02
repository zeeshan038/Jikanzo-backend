import { Request, Response } from 'express';
import { uploadToCloudflare } from '../../utils/cloudflare';

/***
 * @Description Upload a single image to Cloudflare R2
 * @Route POST /api/user/upload-image
 * @Access Private
 */
export const uploadImage = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: false,
                msg: "No image file provided."
            });
        }

        // Upload the file buffer to Cloudflare R2
        const publicFileUrl = await uploadToCloudflare(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );

        return res.status(200).json({
            status: true,
            msg: "Image uploaded successfully",
            url: publicFileUrl
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};
