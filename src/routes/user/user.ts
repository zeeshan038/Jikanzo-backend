import express from 'express';

import {
    sendOtp,
    verifyOtp,
    registerUser,
    loginUser,
    updateProfile,
    whoami,
    checkProfileProgress,
    uploadGallery,
    UpdateFcm,
    testPushNotification,
} from '../../controllers/user/user';

import { uploadImage, uploadVideo } from '../../controllers/user/upload';

import { verifyUser } from '../../middlewares/verifyUser';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/test-push', testPushNotification);

router.use(verifyUser);
router.put('/update-profile', updateProfile);
router.get('/whoami', whoami);
router.post('/update-fcm', UpdateFcm);


router.post('/upload-image', upload.single('image'), uploadImage);
router.post('/upload-video', upload.single('video'), uploadVideo);
router.post('/upload-gallery', uploadGallery);
router.get('/check-progress', checkProfileProgress);

export default router;