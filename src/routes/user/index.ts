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

router.use('/user', userRouter);
router.use('/feed', feedRouter);
router.use('/booking', bookingRouter);
router.use('/stripe', stripeRouter);
router.use('/discover', discoverRouter);
router.use('/moments', momentsRouter);
router.use('/availability', availabilityRouter);

export default router;