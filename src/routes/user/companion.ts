import express from 'express';
import { getDashboardData } from '../../controllers/companion/dashboard';
import { becomeCompanion, becomeClient, toggleOnlineStatus } from '../../controllers/companion/profile';
import { verifyUser } from '../../middlewares/verifyUser';
import { UpdateFcm } from '../../controllers/user/user';

const router = express.Router();

// Require user to be authenticated for all companion routes
router.use(verifyUser);

router.get('/dashboard', getDashboardData);
router.post('/become-companion', becomeCompanion);
router.post('/become-client', becomeClient);
router.post('/toggle-online-status', toggleOnlineStatus);
router.post('/update-fcm', UpdateFcm);

export default router;
