import express from 'express';

import {
    sendOtp,
    verifyOtp,
    registerUser,
    loginUser,
    updateProfile,
    whoami
} from '../../controllers/user/user';

import { uploadImage } from '../../controllers/user/upload';

import { verifyUser } from '../../middlewares/verifyUser';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', registerUser);
router.post('/login', loginUser);

router.use(verifyUser)
router.put('/update-profile', updateProfile);
router.get('/whoami', whoami);

router.post('/upload-image', upload.single('image'), uploadImage);

export default router;