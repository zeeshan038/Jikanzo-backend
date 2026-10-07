//NPM Packages
import { Request, Response } from 'express';

//Config
import prisma from '../../config/db';

//Models
import {
    RegisterSchema,
    SendOtpSchema,
    VerifyOtpSchema,
    LoginSchema,
    UpdateProfileSchema,
    SetActiveLocationSchema,
    UploadGallerySchema,
    normalizeGalleryLayout,
} from '../../schema/user/User';

//Utils
import { genrateToken } from '../../utils/methods';
import {
    generateUniqueCloudflareId,
    ensureR2UserFolders
} from '../../utils/cloudflare';
import { sendPushNotification } from '../../utils/notification';
import { getMessaging } from 'firebase-admin/messaging';
import {
    applyActiveLocationByIndex,
    applyActiveLocationCoordinates,
    formatActiveLocationResponse,
    normalizeSavedLocations,
    parseCoordinate,
    saveUserSavedLocations,
    syncCompanionProfileActiveLocation,
} from '../../utils/savedLocations';


/**
 * @Description Send OTP for Phone Verification
 * @Method POST api/user/send-otp
 * @Access Public
 */
export const sendOtp = async (req: Request, res: Response): Promise<any> => {
    const payload = req.body;

    const result = SendOtpSchema.validate(payload);
    if (result.error) {
        const errors = result.error.details.map((d: any) => d.message).join(",");
        return res.status(400).json({
            status: false,
            msg: errors
        });
    }

    try {
        // Generate a 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Upsert OTP record
        await prisma.otp.upsert({
            where: { phone: payload.phone },
            update: {
                otp,
                expiresAt,
                isVerified: false
            },
            create: {
                phone: payload.phone,
                otp,
                expiresAt,
                isVerified: false
            }
        });

        return res.status(200).json({
            status: true,
            msg: "OTP sent successfully",
            otp
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};

/**
 * @Description Verify OTP
 * @Method POST api/user/verify-otp
 * @Access Public
 */
export const verifyOtp = async (req: Request, res: Response): Promise<any> => {
    const payload = req.body;

    const result = VerifyOtpSchema.validate(payload);
    if (result.error) {
        const errors = result.error.details.map((d: any) => d.message).join(",");
        return res.status(400).json({
            status: false,
            msg: errors
        });
    }

    try {
        const otpRecord = await prisma.otp.findUnique({
            where: { phone: payload.phone }
        });

        if (!otpRecord) {
            return res.status(404).json({
                status: false,
                msg: "OTP request not found for this phone number"
            });
        }

        if (otpRecord.isVerified) {
            return res.status(400).json({
                status: false,
                msg: "Phone number is already verified"
            });
        }

        if (otpRecord.otp !== payload.otp) {
            return res.status(400).json({
                status: false,
                msg: "Invalid OTP"
            });
        }

        if (otpRecord.expiresAt < new Date()) {
            return res.status(400).json({
                status: false,
                msg: "OTP has expired"
            });
        }

        // Mark phone as verified
        await prisma.otp.update({
            where: { id: otpRecord.id },
            data: { isVerified: true }
        });

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
            where: { phone: payload.phone }
        });

        if (existingUser) {
            // User exists: auto-login
            await prisma.otp.delete({ where: { phone: payload.phone } }).catch(() => { });

            const token = genrateToken(existingUser.id.toString());
            
            await prisma.user.update({
                where: { id: existingUser.id },
                data: { currentToken: token }
            });

            return res.status(200).json({
                status: true,
                msg: "Phone number verified. User logged in successfully.",
                isRegistered: true,
                token,
                user: {
                    id: existingUser.id,
                    username: existingUser.username,
                    phone: existingUser.phone,
                    role: existingUser.role
                }
            });
        }

        // New user: proceed to registration
        return res.status(200).json({
            status: true,
            msg: "Phone number verified successfully. You can now register.",
            isRegistered: false
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/** 
 * @Description Register User
 * @Method POST api/user/register
 * @Access Public
 */
export const registerUser = async (req: Request, res: Response): Promise<any> => {
    const payload = req.body;

    const result = RegisterSchema.validate(payload);
    if (result.error) {
        const errors = result.error.details.map((d: any) => d.message).join(",");
        return res.status(400).json({
            status: false,
            msg: errors
        });
    }

    try {
        // 1. Check if the phone number is verified
        const otpRecord = await prisma.otp.findUnique({
            where: { phone: payload.phone }
        });

        if (!otpRecord || !otpRecord.isVerified) {
            return res.status(403).json({
                status: false,
                msg: "Phone number must be verified before registering."
            });
        }

        // 2. Check for existing username or phone in User table
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: payload.username },
                    { phone: payload.phone }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.username === payload.username) {
                return res.status(409).json({
                    status: false,
                    msg: "Username is already taken"
                });
            }
            return res.status(409).json({
                status: false,
                msg: "Phone number is already registered"
            });
        }

        // 3. Create the user
        const cloudflareId = await generateUniqueCloudflareId();
        const role = payload.role || 'CLIENT';
        const userData: any = {
            cloudflareId,
            username: payload.username,
            phone: payload.phone,
            role: role
        };

        if (role === 'COMPANION' || role === 'BOTH') {
            userData.companionProfile = {
                create: {}
            };
        }

        const newUser = await prisma.user.create({
            data: userData
        });

        // Create logical R2 folders for this user asynchronously
        ensureR2UserFolders(cloudflareId).catch((err) => {
            console.warn("[R2] ensureR2UserFolders failed:", err?.message || err);
        });

        // Optional: Clean up OTP record now that they are registered
        await prisma.otp.delete({ where: { phone: payload.phone } }).catch(() => { });

        const token = genrateToken(newUser.id.toString());

        await prisma.user.update({
            where: { id: newUser.id },
            data: { currentToken: token }
        });

        return res.status(201).json({
            status: true,
            msg: "User registered successfully",
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                phone: newUser.phone,
                role: newUser.role
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/** 
 * @Description Login User
 * @Method POST api/user/login
 * @Access Public
 */
export const loginUser = async (req: Request, res: Response): Promise<any> => {
    const payload = req.body;

    const result = LoginSchema.validate(payload);
    if (result.error) {
        const errors = result.error.details.map((d: any) => d.message).join(",");
        return res.status(400).json({
            status: false,
            msg: errors
        });
    }

    try {

        const user = await prisma.user.findUnique({
            where: { phone: payload.phone }
        });

        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        const otpRecord = await prisma.otp.findUnique({
            where: { phone: payload.phone }
        });

        if (!otpRecord) {
            return res.status(404).json({
                status: false,
                msg: "OTP request not found for this phone number"
            });
        }

        if (otpRecord.otp !== payload.otp) {
            return res.status(401).json({
                status: false,
                msg: "Invalid OTP"
            });
        }

        if (otpRecord.expiresAt < new Date()) {
            return res.status(401).json({
                status: false,
                msg: "OTP has expired"
            });
        }

        await prisma.otp.delete({ where: { phone: payload.phone } }).catch(() => { });

        const token = genrateToken(user.id.toString());

        await prisma.user.update({
            where: { id: user.id },
            data: { currentToken: token }
        });

        return res.status(200).json({
            status: true,
            msg: "Login successful",
            token,
            user: {
                id: user.id,
                username: user.username,
                phone: user.phone,
                role: user.role
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Update User Profile
 * @Method PUT api/user/update-profule
 * @Access Private
 */
export const updateProfile = async (req: Request, res: Response): Promise<any> => {
    const payload = req.body;
    const userId = (req as any).user?.id;

    const result = UpdateProfileSchema.validate(payload);
    if (result.error) {
        const errors = result.error.details.map((d: any) => d.message).join(",");
        return res.status(400).json({
            status: false,
            msg: errors
        });
    }

    try {
        const updateData: any = {};

        if (payload.about !== undefined) updateData.about = payload.about;
        if (payload.languages !== undefined) updateData.languages = payload.languages;
        if (payload.activityType !== undefined) updateData.activityType = payload.activityType;
        if (payload.savedLocations !== undefined) {
            updateData.savedLocations = normalizeSavedLocations(payload.savedLocations);
        }
        if (payload.gender !== undefined) updateData.gender = payload.gender;
        if (payload.age !== undefined) updateData.age = payload.age;
        if (payload.username !== undefined) updateData.username = payload.username;
        if (payload.profileImage !== undefined) updateData.profileImage = payload.profileImage;
        if (payload.gallery !== undefined) updateData.gallery = payload.gallery;
        if (payload.intros !== undefined) updateData.intros = payload.intros;
        if (payload.galleryLayout !== undefined) {
            updateData.galleryLayout = normalizeGalleryLayout(payload.galleryLayout);
        }

        const companionUpdate: any = {};
        if (payload.serviceRadius !== undefined) companionUpdate.serviceRadius = payload.serviceRadius;
        if (payload.companionProfileImage !== undefined) companionUpdate.profileImage = payload.companionProfileImage;
        if (payload.companionGallery !== undefined) companionUpdate.gallery = payload.companionGallery;
        if (payload.companionGalleryLayout !== undefined) {
            companionUpdate.galleryLayout = normalizeGalleryLayout(payload.companionGalleryLayout);
        }

        if (Object.keys(companionUpdate).length > 0) {
            updateData.companionProfile = {
                update: companionUpdate
            };
        }

        if (updateData.username) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    username: updateData.username,
                    NOT: { id: userId }
                }
            });
            if (existingUser) {
                return res.status(409).json({
                    status: false,
                    msg: "Username is already taken"
                });
            }
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        // Keep companionProfile.bio in sync when the app edits User.about (feed reads bio)
        if (payload.about !== undefined) {
            await prisma.companionProfile.updateMany({
                where: { userId },
                data: { bio: payload.about },
            });
        }

        if (payload.savedLocations !== undefined) {
            await syncCompanionProfileActiveLocation(
                userId,
                normalizeSavedLocations(updateData.savedLocations),
            );
        }

        return res.status(200).json({
            status: true,
            msg: "Profile updated successfully"
        });

    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Set active location (GPS fix or pick saved index)
 * @Route PUT /api/user/active-location
 * @Access Private
 */
export const setActiveLocation = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user?.id;

    const result = SetActiveLocationSchema.validate(req.body);
    if (result.error) {
        const errors = result.error.details.map((d: any) => d.message).join(',');
        return res.status(400).json({ status: false, msg: errors });
    }

    const payload = result.value;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { savedLocations: true },
        });

        if (!user) {
            return res.status(404).json({ status: false, msg: 'User not found' });
        }

        let nextLocations;
        if (payload.index !== undefined) {
            try {
                nextLocations = applyActiveLocationByIndex(user.savedLocations, payload.index);
            } catch {
                return res.status(400).json({ status: false, msg: 'Invalid location index' });
            }
        } else {
            const lat = parseCoordinate(payload.lat);
            const lng = parseCoordinate(payload.lng);
            if (lat === null || lng === null) {
                return res.status(400).json({ status: false, msg: 'Invalid lat or lng' });
            }
            nextLocations = applyActiveLocationCoordinates(
                user.savedLocations,
                lat,
                lng,
                payload.name,
            );
        }

        const data = await saveUserSavedLocations(userId, nextLocations);

        return res.status(200).json({
            status: true,
            msg: 'Active location updated successfully',
            data,
        });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};


/**
 * @Description List saved locations for booking / location picker
 * @Route GET /api/user/saved-locations
 * @Access Private
 */
export const getSavedLocations = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user?.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { savedLocations: true },
        });

        if (!user) {
            return res.status(404).json({ status: false, msg: 'User not found' });
        }

        const savedLocations = normalizeSavedLocations(user.savedLocations);
        const activeIndex = savedLocations.findIndex((l) => l.isActive);

        return res.status(200).json({
            status: true,
            msg: 'Saved locations fetched successfully',
            data: {
                savedLocations: savedLocations.map((loc, index) => ({
                    index,
                    lat: loc.lat,
                    lng: loc.lng,
                    ...(loc.name ? { name: loc.name } : {}),
                    isActive: loc.isActive === true,
                })),
                activeIndex: activeIndex >= 0 ? activeIndex : null,
                activeLocation: formatActiveLocationResponse(savedLocations),
            },
        });
    } catch (error: any) {
        return res.status(500).json({ status: false, msg: error.message });
    }
};


/**
 * @Description Get User Profile
 * @Method GET api/user/whoami
 * @Access Private
 */
export const whoami = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user?.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                phone: true,
                role: true,
                profileImage: true,
                about: true,
                languages: true,
                activityType: true,
                savedLocations: true,
                gender: true,
                age: true,
                walletBalance: true,
                gallery: true,
                galleryLayout: true,
                intros: true,
                companionProfile: {
                    select: {
                        id: true,
                        locationLat: true,
                        locationLng: true,
                        serviceRadius: true,
                        profileImage: true,
                        gallery: true,
                        galleryLayout: true,
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        let filledFields = 0;
        const totalFields = 8;
        
        if (user.profileImage) filledFields++;
        if (user.username) filledFields++;
        if (user.about) filledFields++;
        if (user.gender) filledFields++;
        if (user.age) filledFields++;
        if (user.languages && user.languages.length > 0) filledFields++;
        if (user.activityType && user.activityType.length > 0) filledFields++;
        if (user.gallery && user.gallery.length > 0) filledFields++;

        const profileProgress = Math.round((filledFields / totalFields) * 100);
        const savedLocations = normalizeSavedLocations(user.savedLocations);
        let activeLocation = formatActiveLocationResponse(savedLocations);
        if (
            !activeLocation &&
            user.companionProfile?.locationLat != null &&
            user.companionProfile?.locationLng != null
        ) {
            activeLocation = {
                lat: user.companionProfile.locationLat,
                lng: user.companionProfile.locationLng,
            };
        }

        return res.status(200).json({
            status: true,
            msg: "User profile fetched successfully",
            user: {
                ...user,
                savedLocations,
                activeLocation,
                gallery: user.gallery ?? [],
                galleryLayout: user.galleryLayout ?? '1',
                profileProgress,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};


/**
 * @Description Check Profile Verifitcation Progress
 * @Method POST api/user/check-profile-progress
 * @Access Private
 */
export const checkProfileProgress = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user?.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { companionProfile: true }
        });

        if (!user) {
            return res.status(404).json({ status: false, msg: "User not found" });
        }

        let totalFields = 0;
        let completedFields = 0;

        const checkField = (field: any) => {
            totalFields++;
            if (field !== null && field !== undefined && field !== "" && field !== 0) {
                if (Array.isArray(field) && field.length === 0) return;
                completedFields++;
            }
        };

        // Check base user fields
        checkField(user.profileImage);
        checkField(user.about);
        checkField(user.languages);
        checkField(user.activityType);
        checkField(user.gender);
        checkField(user.age);
        checkField(user.gallery);
        checkField(user.intros);

        // Check companion fields if applicable
        if (user.role === 'COMPANION' || user.role === 'BOTH') {
            const companion = user.companionProfile;
            checkField(companion?.bio);
            checkField(companion?.hourlyRate);
            const savedLocs = normalizeSavedLocations(user.savedLocations);
            checkField(savedLocs.length > 0 ? savedLocs : companion?.locationLat);
        }

        const percentage = totalFields === 0 ? 0 : Math.round((completedFields / totalFields) * 100);

        return res.status(200).json({
            status: true,
            msg: "Profile progress calculated",
            data: {
                percentage,
                completedFields,
                totalFields
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Update FCM 
 * @Method POST api/user/update-fcm
 * @Access Private
 */
export const UpdateFcm = async (req: Request, res: Response): Promise<any> =>{
    const userId = (req as any).user?.id;
    const { fcm } = req.body;

    if (!fcm) {
        return res.status(400).json({
            status: false,
            msg: "fcm is required"
        });
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: { fcmToken: fcm }
        });

        return res.status(200).json({
            status: true,
            msg: "FCM token updated successfully"
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Upload Galery Images
 * @Method POST api/user/upload-gallery
 * @Access Private
 */
export const uploadGallery = async (req: Request, res: Response): Promise<any> => {
    const userId = (req as any).user?.id;

    const validation = UploadGallerySchema.validate(req.body);
    if (validation.error) {
        const errors = validation.error.details.map((d: any) => d.message).join(', ');
        return res.status(400).json({ status: false, msg: errors });
    }

    try {
        const { images, isCompanion } = validation.value;
        const galleryLayout = normalizeGalleryLayout(validation.value.galleryLayout);

        if (isCompanion) {
            const updated = await prisma.companionProfile.update({
                where: { userId },
                data: {
                    galleryLayout,
                    gallery: {
                        push: images,
                    },
                },
                select: {
                    gallery: true,
                    galleryLayout: true,
                },
            });

            return res.status(200).json({
                status: true,
                msg: "Companion gallery updated successfully",
                galleryLayout: updated.galleryLayout,
                urls: images,
                gallery: updated.gallery,
            });
        } else {
            const updated = await prisma.user.update({
                where: { id: userId },
                data: {
                    galleryLayout,
                    gallery: {
                        push: images,
                    },
                },
            select: {
                gallery: true,
                galleryLayout: true,
            },
        });

        return res.status(200).json({
            status: true,
            msg: "Gallery updated successfully",
            galleryLayout: updated.galleryLayout,
            urls: images,
            gallery: updated.gallery,
        });
        }
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
}


/**
 * @Description Test Push Notification (no auth — dev/testing only)
 * @Method POST api/user/test-push
 * @Access Public
 */
export const testPushNotification = async (req: Request, res: Response): Promise<any> => {
    const { fcm, title, body, userId: userIdRaw } = req.body;

    if (fcm == null || typeof fcm !== 'string' || !fcm.trim()) {
        return res.status(400).json({
            status: false,
            msg: 'fcm is required (device FCM token)',
        });
    }

    const token = fcm.trim();
    const notifTitle =
        typeof title === 'string' && title.trim() ? title.trim() : 'Jikanzo test';
    const notifBody =
        typeof body === 'string' && body.trim()
            ? body.trim()
            : 'Push notifications are working.';

    try {
        const userId = userIdRaw != null ? Number(userIdRaw) : NaN;

        if (Number.isFinite(userId) && userId > 0) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });

            if (!user) {
                return res.status(404).json({
                    status: false,
                    msg: `User with id ${userId} not found. Omit userId to send FCM only, or use a valid user id from the database.`,
                });
            }

            await prisma.user.update({
                where: { id: userId },
                data: { fcmToken: token },
            });

            const result = await sendPushNotification(
                userId,
                notifTitle,
                notifBody,
                { test: 'true' },
                'TEST_PUSH'
            );

            if (result.error) {
                return res.status(502).json({
                    status: false,
                    msg: result.error,
                    data: result,
                });
            }

            if (!result.fcmSent) {
                return res.status(400).json({
                    status: false,
                    msg: 'Notification saved but FCM was not sent.',
                    data: result,
                });
            }

            return res.status(200).json({
                status: true,
                msg: 'Test push notification sent successfully',
                data: {
                    userId,
                    messageId: result.messageId,
                },
            });
        }

        const messageId = await getMessaging().send({
            notification: { title: notifTitle, body: notifBody },
            data: { test: 'true', type: 'TEST_PUSH' },
            token,
        });

        return res.status(200).json({
            status: true,
            msg: 'Test push notification sent successfully',
            data: { messageId },
        });
    } catch (error: any) {
        return res.status(502).json({
            status: false,
            msg: error?.message || 'Failed to send push notification',
        });
    }
};


