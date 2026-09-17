import express from 'express';
import { 
  bookCompanion, 
  acceptBookingController, 
  payWithWallet, 
  completeBookingController, 
  getClientBookings, 
  getCompanionBookings,
  requestExtension,
  respondToExtension
} from '../../controllers/user/booking';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser)
router.get('/client', getClientBookings);
router.get('/companion', getCompanionBookings);
router.post('/book-companion/:id', bookCompanion);
router.post('/accept', acceptBookingController);
router.post('/complete', completeBookingController);
router.post('/pay-with-wallet', payWithWallet);
router.post('/:id/request-extension', requestExtension);
router.post('/:id/respond-extension', respondToExtension);

export default router;
