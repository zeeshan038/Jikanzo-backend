import express from 'express';
import { getNotifications, markAsRead, deleteNotifications } from '../../controllers/user/notification';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);

router.get('/', getNotifications);
router.post('/:id/read', markAsRead);
router.delete('/delete/:id', deleteNotifications);

export default router;
