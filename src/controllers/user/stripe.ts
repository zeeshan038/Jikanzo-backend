//NPM Packages
import { Request, Response } from 'express';
import Stripe from 'stripe';
import prisma from '../../config/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

/**
 * @Description Create Payment intent
 * @Route POST /api/strip/create-intent
 * @Access Private
 */
export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ status: false, msg: "bookingId is required" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: { companion: true }
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    // Calculate amount
    const hourlyRate = booking.companion.hourlyRate || 0;
    const hours = (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60);
    const amount = Math.round(hours * hourlyRate * 100); // Amount in cents/paise

    if (amount <= 0) {
      return res.status(400).json({ status: false, msg: "Invalid amount calculated" });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'inr', // or 'usd' depending on your region
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingId: booking.id.toString(),
      }
    });

    // Update the booking with the intent ID and amount
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        totalAmount: amount / 100, // store in dollars/rupees
        stripePaymentIntentId: paymentIntent.id
      }
    });

    res.status(200).json({
      status: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: amount / 100
      }
    });
  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

import { addMoneySchema } from '../../schema/user/wallet';

export const addMoneyToWallet = async (req: Request, res: Response) => {
  try {
    const { error, value } = addMoneySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ status: false, msg: error.details[0].message });
    }

    const { amount } = value;
    const userId = (req as any).user?.id || 1; // Fallback for testing

    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'inr',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: 'WALLET_TOPUP',
        userId: userId.toString(),
      }
    });

    res.status(200).json({
      status: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        amount: amount
      }
    });
  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Stripe webhook
 * @Route Webhook /api/stripe/stripe-webhook
 * @Access Private
 */
export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_key_replace_me';

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntentSucceeded = event.data.object as Stripe.PaymentIntent;
        const type = paymentIntentSucceeded.metadata.type;

        if (type === 'WALLET_TOPUP') {
          const userId = Number(paymentIntentSucceeded.metadata.userId);
          const amount = paymentIntentSucceeded.amount / 100;

          if (userId) {
            await prisma.$transaction(async (tx) => {
              await tx.user.update({
                where: { id: userId },
                data: { walletBalance: { increment: amount } }
              });

              await tx.walletTransaction.create({
                data: {
                  userId,
                  amount,
                  type: 'CREDIT',
                  description: 'Added funds via Stripe'
                }
              });
            });
            console.log(`Wallet top-up for user ${userId} succeeded.`);
          }
        } else {
          // Booking Payment
          const bookingId = paymentIntentSucceeded.metadata.bookingId;
          if (bookingId) {
            await prisma.booking.update({
              where: { id: Number(bookingId) },
              data: { paymentStatus: 'PAID' }
            });
            console.log(`Payment for booking ${bookingId} succeeded.`);
          }
        }
        break;
      
      case 'payment_intent.payment_failed':
          const paymentIntentFailed = event.data.object as Stripe.PaymentIntent;
          const failedType = paymentIntentFailed.metadata.type;
          
          if (failedType !== 'WALLET_TOPUP') {
            const failedBookingId = paymentIntentFailed.metadata.bookingId;
            if (failedBookingId) {
              await prisma.booking.update({
                where: { id: Number(failedBookingId) },
                data: { paymentStatus: 'FAILED' }
              });
              console.log(`Payment for booking ${failedBookingId} failed.`);
            }
          }
          break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error("Error processing webhook event", error);
  }

  res.send();
};
