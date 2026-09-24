import express from 'express';
import { 
  bookCompanion, 
  acceptBookingController, 
  payWithWallet, 
  completeBookingController, 
  getClientBookings, 
  getCompanionBookings,
  requestExtension,
  respondToExtension,
  startBookingController,
  getCancelReasons,
  getBookingById,
  getBookingReceipt,
  cancelBookingController,
  rescheduleBookingController,
  verifyBookingOtpController,
} from '../../controllers/user/booking';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);
router.get('/client', getClientBookings);
router.get('/companion', getCompanionBookings);
router.get('/cancel-reasons', getCancelReasons);
router.get('/detail/:id', getBookingById);
router.get('/receipt/:id', getBookingReceipt);
router.post('/book-companion/:id', bookCompanion);
router.post('/accept', acceptBookingController);
router.post('/complete', completeBookingController);
router.post('/pay-with-wallet', payWithWallet);
router.post('/cancel/:id', cancelBookingController);
router.patch('/reschedule/:id', rescheduleBookingController);
router.post('/verify-otp/:id', verifyBookingOtpController);
router.post('/request-extension/:id', requestExtension);
router.post('/respond-extension/:id', respondToExtension);
router.post('/start/:id', startBookingController);

export default router;
