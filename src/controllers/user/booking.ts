import { Request, Response } from "express";
import prisma from "../../config/db";
import { createBooking, acceptBooking } from "../../schema/user/booking";

/**
 * @Description Book a companion
 * @Route POST /api/booking/book-companion/:id
 * @Access Private
 */
export const bookCompanion = async (req: Request, res: Response) => {
    const payload = req.body;
    const {id:clientId} = req.user;
    const {id:companionId} = req.params;
  
      const result = createBooking.validate(payload);
      if (result.error) {
          const errors = result.error.details.map((d: any) => d.message).join(",");
          return res.status(400).json({
              status: false,
              msg: errors
          });
      }

  try {

    const { date, startTime, endTime } = result.value;

    const companion = await prisma.companionProfile.findUnique({
      where: { id: Number(companionId) }
    });

    if (!companion) {
      return res.status(404).json({ status: false, msg: "Companion not found" });
    }

    const booking = await prisma.booking.create({
      data: {
        clientId,
        companionId: Number(companionId),
        date: new Date(date),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "PENDING"
      }
    });

    return res.status(201).json({
      status: true,
      msg: "Booking request created successfully",
      data: booking
    });
  } catch (error: any) {
    res.status(500).json({
       status: false, 
       msg:error.message 
     });
  }
};

/**
 * @Description Accept or decline a booking
 * @Route POST /api/booking/accept
 * @Access Private
 */
export const acceptBookingController = async (req: Request, res: Response) => {
  const payload = req.body;

  const result = acceptBooking.validate(payload);

   if (result.error) {
          const errors = result.error.details.map((d: any) => d.message).join(",");
          return res.status(400).json({
              status: false,
              msg: errors
          });
      }

  try {


    const { bookingId, action } = result.value;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { companion: true }
    });

    if (!booking) {
      return res.status(404).json({
         status: false, 
         msg: "Booking not found" 
        });
    }

    const newStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'CANCELLED';

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: newStatus }
    });

    return res.status(200).json({
      status: true,
      msg: `Booking ${action.toLowerCase()}ed successfully`,
      data: updatedBooking
    });
  } catch (error: any) {
    res.status(500).json({
       status: false, 
       msg: error.message 
     });
  }
};

import { payWithWalletSchema } from '../../schema/user/wallet';

/**
 * @Description Pay for a booking with wallet balance
 * @Route POST /api/booking/pay-with-wallet
 * @Access Private
 */
export const payWithWallet = async (req: Request, res: Response) => {
  const payload = req.body;
  const userId = (req as any).user?.id || 1; // Fallback for testing

  const result = payWithWalletSchema.validate(payload);
  if (result.error) {
    const errors = result.error.details.map((d: any) => d.message).join(",");
    return res.status(400).json({ status: false, msg: errors });
  }

  const { bookingId } = result.value;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({ status: false, msg: "Booking is not in a payable state" });
    } 

    if (booking.paymentStatus === 'PAID') {
      return res.status(400).json({ status: false, msg: "Booking is already paid" });
    }

    const totalAmount = booking.totalAmount || 0;
    if (totalAmount <= 0) {
      return res.status(400).json({ status: false, msg: "Invalid booking amount" });
    }

    // Check user's wallet balance
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.walletBalance < totalAmount) {
      return res.status(400).json({ status: false, msg: "Insufficient wallet balance" });
    }

    // Process transaction securely
    await prisma.$transaction(async (tx) => {
      // 1. Deduct from client
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { decrement: totalAmount } }
      });

      // 2. Add to companion
      const companion = await tx.companionProfile.findUnique({
        where: { id: booking.companionId }
      });

      if (companion) {
        await tx.user.update({
          where: { id: companion.userId },
          data: { walletBalance: { increment: totalAmount } }
        });

        // 3. Create client ledger entry
        await tx.walletTransaction.create({
          data: {
            userId: userId,
            amount: totalAmount,
            type: 'DEBIT',
            description: `Paid for booking #${booking.id}`
          }
        });

        // 4. Create companion ledger entry
        await tx.walletTransaction.create({
          data: {
            userId: companion.userId,
            amount: totalAmount,
            type: 'CREDIT',
            description: `Received payment for booking #${booking.id}`
          }
        });
      }

      // 5. Update booking status
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentStatus: 'PAID' }
      });
    });

    res.status(200).json({
      status: true,
      msg: "Payment successful",
      data: { bookingId, paymentStatus: 'PAID', amountDeducted: totalAmount }
    });

  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

