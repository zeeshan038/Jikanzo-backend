import express from 'express';

const router = express.Router();

//User Routes
import userRouter from './user';
import feedRouter from './feed';
import bookingRouter from './booking';
import stripeRouter from './stripe';
import discoverRouter from './discover';
import momentsRouter from './moments';
import availabilityRouter from './availability';
import companionRouter from './companion';
import reviewRouter from './review';

router.use('/user', userRouter);
router.use('/feed', feedRouter);
router.use('/booking', bookingRouter);
router.use('/stripe', stripeRouter);
router.use('/discover', discoverRouter);
router.use('/moments', momentsRouter);
router.use('/availability', availabilityRouter);
router.use('/companion', companionRouter);
router.use('/review', reviewRouter);

export default router;