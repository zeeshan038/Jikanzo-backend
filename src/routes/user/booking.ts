import express from 'express';
import { bookCompanion, acceptBookingController, payWithWallet, completeBookingController } from '../../controllers/user/booking';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser)
router.post('/book-companion', bookCompanion);
router.post('/accept', acceptBookingController);
router.post('/complete', completeBookingController);
router.post('/pay-with-wallet', payWithWallet);

export default router;
