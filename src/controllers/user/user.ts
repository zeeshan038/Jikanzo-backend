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
    UpdateProfileSchema
} from '../../schema/user/User';

//Utils
import { genrateToken } from '../../utils/methods';
import { generateUniqueCloudflareId, ensureR2UserFolders } from '../../utils/cloudflare';


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

        return res.status(200).json({
            status: true,
            msg: "Phone number verified successfully. You can now register."
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
        await prisma.otp.delete({ where: { phone: payload.phone } }).catch(() => {});

        const token = genrateToken(newUser.id.toString());

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

        await prisma.otp.delete({ where: { phone: payload.phone } }).catch(() => {});

        const token = genrateToken(user.id.toString());

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
        if (payload.savedLocations !== undefined) updateData.savedLocations = payload.savedLocations;
        if (payload.gender !== undefined) updateData.gender = payload.gender;
        if (payload.age !== undefined) updateData.age = payload.age;
        if (payload.username !== undefined) updateData.username = payload.username;
        if (payload.profileImage !== undefined) updateData.profileImage = payload.profileImage;
        if (payload.gallery !== undefined) updateData.gallery = payload.gallery;
        if (payload.intros !== undefined) updateData.intros = payload.intros;

        if (updateData.username) {
            const existingUser = await prisma.user.findFirst({
                where: { 
                    username: updateData.username,
                    NOT: { id: userId }
                }
            });
            if (existingUser) {
                return res.status(409).json({ status: false, msg: "Username is already taken" });
            }
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        return res.status(200).json({
            status: true,
            msg: "Profile updated successfully",
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                about: updatedUser.about,
                languages: updatedUser.languages,
                activityType: updatedUser.activityType,
                gender: updatedUser.gender,
                age: updatedUser.age,
                profileImage: updatedUser.profileImage,
                gallery: updatedUser.gallery,
                intros: updatedUser.intros
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
                intros: true,
                
            }
        });

        if (!user) {
            return res.status(404).json({
                status: false,
                msg: "User not found"
            });
        }

        return res.status(200).json({
            status: true,
            msg: "User profile fetched successfully",
            user
        });
    } catch (error: any) {
        return res.status(500).json({
            status: false,
            msg: error.message
        });
    }
};
