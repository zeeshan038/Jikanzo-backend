import { Request, Response } from 'express';
import {
    deleteFromCloudflare,
    publicUrlToObjectKey,
    uploadToCloudflare,
} from '../../utils/cloudflare';
import prisma from '../../config/db';
import { DeleteMediaSchema } from '../../schema/user/User';

function urlEquals(a: string, b: string): boolean {
    return a.trim() === b.trim();
}

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



/***
 * @Description Upload a single video to Cloudflare R2 and add to intros
 * @Route POST /api/user/upload-video
 * @Access Private
 */
export const uploadVideo = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: false,
                msg: "No video file provided."
            });
        }

        // Upload the file buffer to Cloudflare R2
        const publicFileUrl = await uploadToCloudflare(
            req.file.buffer,
            req.file.mimetype,
            req.file.originalname
        );

        // Append the video URL to the user's intros array
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                intros: {
                    push: publicFileUrl
                }
            }
        });

        return res.status(200).json({
            status: true,
            msg: "Video uploaded successfully",
            url: publicFileUrl
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Remove uploaded media from profile fields and Cloudflare R2
 * @Route DELETE /api/user/media
 * @Access Private
 * @Body { url: string, scope?: "auto" | "gallery" | "profile" | "intro" }
 */
export const deleteMedia = async (req: Request, res: Response) => {
    const userId = (req as any).user?.id as number;

    const validation = DeleteMediaSchema.validate(req.body);
    if (validation.error) {
        const errors = validation.error.details.map((d) => d.message).join(', ');
        return res.status(400).json({ status: false, msg: errors });
    }

    const { url, scope } = validation.value as { url: string; scope: string };

    if (!publicUrlToObjectKey(url)) {
        return res.status(400).json({
            status: false,
            msg: 'URL must be a file hosted on this app CDN (from upload-image or upload-video).',
        });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                profileImage: true,
                gallery: true,
                intros: true,
                companionProfile: { select: { id: true } },
            },
        });

        if (!user) {
            return res.status(404).json({ status: false, msg: 'User not found' });
        }

        if (user.companionProfile) {
            const momentRef = await prisma.moment.findFirst({
                where: {
                    mediaUrl: url,
                    companionId: user.companionProfile.id,
                },
                select: { id: true },
            });
            if (momentRef) {
                return res.status(400).json({
                    status: false,
                    msg: 'This file is used by an active moment. Delete the moment first.',
                });
            }
        }

        const removedFrom: string[] = [];
        let nextGallery = [...user.gallery];
        let nextProfileImage = user.profileImage;
        let nextIntros = [...user.intros];

        const touchGallery =
            scope === 'auto' || scope === 'gallery'
                ? nextGallery.some((u) => urlEquals(u, url))
                : false;
        const touchProfile =
            scope === 'auto' || scope === 'profile'
                ? user.profileImage != null && urlEquals(user.profileImage, url)
                : false;
        const touchIntro =
            scope === 'auto' || scope === 'intro'
                ? nextIntros.some((u) => urlEquals(u, url))
                : false;

        if (scope === 'gallery' && !touchGallery) {
            return res.status(404).json({
                status: false,
                msg: 'URL not found in your gallery.',
            });
        }
        if (scope === 'profile' && !touchProfile) {
            return res.status(404).json({
                status: false,
                msg: 'URL does not match your profile image.',
            });
        }
        if (scope === 'intro' && !touchIntro) {
            return res.status(404).json({
                status: false,
                msg: 'URL not found in your intros.',
            });
        }
        if (scope === 'auto' && !touchGallery && !touchProfile && !touchIntro) {
            return res.status(404).json({
                status: false,
                msg: 'URL not found on your profile (gallery, profile image, or intros).',
            });
        }

        if (touchGallery) {
            nextGallery = nextGallery.filter((u) => !urlEquals(u, url));
            removedFrom.push('gallery');
        }
        if (touchProfile) {
            nextProfileImage = '';
            removedFrom.push('profile');
        }
        if (touchIntro) {
            nextIntros = nextIntros.filter((u) => !urlEquals(u, url));
            removedFrom.push('intro');
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                gallery: nextGallery,
                profileImage: nextProfileImage,
                intros: nextIntros,
            },
            select: {
                profileImage: true,
                gallery: true,
                intros: true,
            },
        });

        let storageDeleted = true;
        try {
            await deleteFromCloudflare(url);
        } catch (storageErr: any) {
            storageDeleted = false;
            console.error('[deleteMedia] R2 delete failed:', storageErr?.message || storageErr);
        }

        return res.status(200).json({
            status: true,
            msg: storageDeleted
                ? 'Media removed successfully'
                : 'Media removed from profile; storage delete failed (file may remain in bucket)',
            removedFrom,
            storageDeleted,
            profileImage: updated.profileImage,
            gallery: updated.gallery,
            intros: updated.intros,
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message,
        });
    }
};
