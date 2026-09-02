import express from 'express';

const router = express.Router();

//User Routes
import userRouter from './user';
import feedRouter from './feed';
import bookingRouter from './booking';
import stripeRouter from './stripe';
import discoverRouter from './discover';

router.use('/user', userRouter);
router.use('/feed', feedRouter);
router.use('/booking', bookingRouter);
router.use('/stripe', stripeRouter);
router.use('/discover', discoverRouter);

export default router;