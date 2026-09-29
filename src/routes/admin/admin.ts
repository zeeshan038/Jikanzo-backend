import express from 'express';
import { loginAdmin } from '../../controllers/admin/admin';
import {
  getBookingAndRevenueTrend,
  getStats,
  getNeedsAttentionList,
  getTrustTierDistribution,
} from '../../controllers/admin/dashboard';
import { verifyAdmin } from '../../middlewares/verifyAdmin';

const router = express.Router();

router.post('/login', loginAdmin);

router.use(verifyAdmin);
router.get('/dashboard/stats', getStats);
router.get('/dashboard/booking-and-revenue-trend', getBookingAndRevenueTrend);
router.get('/dashboard/trust-tier', getTrustTierDistribution);
router.get('/dashboard/needs-attention-list', getNeedsAttentionList);

export default router;
