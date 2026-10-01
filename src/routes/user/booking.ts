import express from 'express';
import { 
  bookCompanion, 
  acceptBookingController, 
  payWithWallet, 
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
import {
  getBookingTracking,
  joinBookingTracking,
  leaveBookingTracking,
} from '../../controllers/user/tracking';
import { getHomeBookingBar } from '../../controllers/user/homeBar';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser);
router.get('/client', getClientBookings);
router.get('/companion', getCompanionBookings);
router.get('/cancel-reasons', getCancelReasons);
router.get('/home-bar', getHomeBookingBar);
router.get('/:id/tracking', getBookingTracking);
router.post('/:id/tracking/join', joinBookingTracking);
router.post('/:id/tracking/leave', leaveBookingTracking);
router.get('/detail/:id', getBookingById);
router.get('/receipt/:id', getBookingReceipt);
router.post('/book-companion/:id', bookCompanion);
router.post('/accept', acceptBookingController);
router.post('/pay-with-wallet', payWithWallet);
router.post('/cancel/:id', cancelBookingController);
router.patch('/reschedule/:id', rescheduleBookingController);
router.post('/verify-otp/:id', verifyBookingOtpController);
router.post('/request-extension/:id', requestExtension);
router.post('/respond-extension/:id', respondToExtension);
router.post('/start/:id', startBookingController);

export default router;
