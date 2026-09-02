import express from 'express';
import { createPaymentIntent, stripeWebhook, addMoneyToWallet } from '../../controllers/user/stripe';
import { verifyUser } from '../../middlewares/verifyUser';

const router = express.Router();

router.use(verifyUser)

router.post('/webhook', express.raw({type: 'application/json'}), stripeWebhook);
router.post('/create-payment-intent', express.json(), createPaymentIntent);
router.post('/add-money', express.json(), addMoneyToWallet);

export default router;
