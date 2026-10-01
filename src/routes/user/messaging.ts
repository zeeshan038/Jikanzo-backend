import express from 'express';
import {
  getMessageCatalog,
  getMessagingStatus,
  listBookingMessages,
  getQuickReplies,
  sendBookingMessage,
} from '../../controllers/user/messaging';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);

router.get('/catalog', getMessageCatalog);
router.get('/:id/status', getMessagingStatus);
router.get('/:id/quick-replies', getQuickReplies);
router.get('/:id', listBookingMessages);
router.post('/:id', sendBookingMessage);

export default router;
