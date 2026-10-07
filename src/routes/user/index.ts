import express from 'express';

const router = express.Router();

//User Routes
import userRouter from './user';
import feedRouter from './feed';
import bookingRouter from './booking';
import messagingRouter from './messaging';
import callingRouter from './calling';
import stripeRouter from './stripe';
import discoverRouter from './discover';
import momentsRouter from './moments';
import availabilityRouter from './availability';
import companionRouter from './companion';
import reviewRouter from './review';
import notificationRouter from './notification';
import adminRouter from '../admin/admin';

router.use('/user', userRouter);
router.use('/admin', adminRouter);
router.use('/feed', feedRouter);
router.use('/booking', bookingRouter);
router.use('/messaging', messagingRouter);
router.use('/calling', callingRouter);
router.use('/stripe', stripeRouter);
router.use('/discover', discoverRouter);
router.use('/moments', momentsRouter);
router.use('/availability', availabilityRouter);
router.use('/companion', companionRouter);
router.use('/review', reviewRouter);
router.use('/notification', notificationRouter);

export default router;