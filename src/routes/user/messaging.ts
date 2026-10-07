import express from 'express';
import multer from 'multer';
import {
  getMessageCatalog,
  getMessagingStatus,
  listBookingMessages,
  getQuickReplies,
  sendBookingMessage,
  uploadBookingChatImage,
} from '../../controllers/user/messaging';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(verifyUser);

router.get('/catalog', getMessageCatalog);
router.get('/:id/status', getMessagingStatus);
router.get('/:id/quick-replies', getQuickReplies);
router.get('/:id', listBookingMessages);
router.post('/:id/upload-image', upload.single('image'), uploadBookingChatImage);
router.post('/:id', sendBookingMessage);

export default router;
