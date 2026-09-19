import express from 'express';
import { getNotifications, markAsRead } from '../../controllers/user/notification';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);

router.get('/', getNotifications);
router.post('/:id/read', markAsRead);

export default router;
