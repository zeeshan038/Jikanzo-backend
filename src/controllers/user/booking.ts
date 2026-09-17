import { Request, Response } from "express";
import prisma from "../../config/db";
import { createBooking, acceptBooking } from "../../schema/user/booking";
import { payWithWalletSchema } from '../../schema/user/wallet';
import { calculateJSS } from "../../utils/jssCalculator";

/**
 * @Description Book a companion
 * @Route POST /api/booking/book-companion/:id
 * @Access Private
 */
export const bookCompanion = async (req: Request, res: Response) => {
  const payload = req.body;
  const { id: clientId } = req.user;
  const { id: companionId } = req.params;

  const result = createBooking.validate(payload);
  if (result.error) {
    const errors = result.error.details.map((d: any) => d.message).join(",");
    return res.status(400).json({
      status: false,
      msg: errors
    });
  }

  try {



    const companion = await prisma.companionProfile.findUnique({
      where: { id: Number(companionId) },
      include: { user: true } // Include user to get the companion's user details for notification
    });

    if (!companion) {
      return res.status(404).json({ status: false, msg: "Companion not found" });
    }

    // Generate a 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    const booking = await prisma.booking.create({
      data: {
        clientId,
        companionId: Number(companionId),
        date: new Date(payload.date),
        startTime: new Date(payload.startTime),
        endTime: new Date(payload.endTime),
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        status: "PENDING",
        otp // Save OTP in DB
      }
    });

    // Send push notification to the companion
    import('../../utils/notification').then(({ sendPushNotification }) => {
      if (companion.userId) {
        sendPushNotification(
          companion.userId,
          "New Booking Request",
          "You have received a new booking request.",
          { bookingId: booking.id }
        );
      }
    }).catch(err => console.error("Failed to send notification:", err));

    return res.status(201).json({
      status: true,
      msg: "Booking request created successfully",
      data: booking
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      msg: error.message
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

    const updateData: any = { status: newStatus };

    // If it's cancelled, log who cancelled it. Also apply reliability penalty if companion responsible
    if (newStatus === 'CANCELLED') {
      const isCompanion = (req as any).user?.id === booking.companion.userId;
      updateData.cancelledById = (req as any).user?.id;

      if (isCompanion) {
        // Decrease reliability score by 10 (configurable)
        await prisma.companionProfile.update({
          where: { id: booking.companionId },
          data: {
            reliabilityScore: { decrement: 10 }
          }
        });
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData
    });

    // Trigger JSS Recalculation if it's a cancellation
    if (newStatus === 'CANCELLED') {
      // Run asynchronously
      calculateJSS(booking.companionId).catch(err => console.error("JSS Calculation Error:", err));
    }

    return res.status(200).json({
      status: true,
      msg: `Booking ${action.toLowerCase()}ed successfully`
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};

/**
 * @Description Complete a booking
 * @Route POST /api/booking/complete
 * @Access Private
 */
export const completeBookingController = async (req: Request, res: Response) => {
  const { bookingId, otp } = req.body;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    if (booking.otp !== otp) {
      return res.status(400).json({ status: false, msg: "Invalid OTP provided" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED' }
    });

    // Trigger JSS Recalculation asynchronously
    calculateJSS(booking.companionId).catch(err => console.error("JSS Calculation Error:", err));

    return res.status(200).json({
      status: true,
      msg: "Booking completed successfully",
      data: updatedBooking
    });
  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};


/**
 * @Description Pay for a booking with wallet balance
 * @Route POST /api/booking/pay-with-wallet
 * @Access Private
 */
export const payWithWallet = async (req: Request, res: Response) => {
  const payload = req.body;
  const userId = (req as any).user?.id;

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


/**
 * @Description Get client bookings (history, upcoming, requests)
 * @Route GET /api/booking/client?type=requests
 * @Access Private
 */
export const getClientBookings = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { type } = req.query;

  try {
    const whereClause: any = { clientId: userId };

    if (type === 'requests') {
      whereClause.status = 'PENDING';
    } else if (type === 'upcoming') {
      whereClause.status = { in: ['ACCEPTED', 'ACTIVE'] };
    } else if (type === 'history') {
      whereClause.status = { in: ['COMPLETED', 'CANCELLED'] };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        date: true,
        startTime: true,
        endTime: true,
        address: true,
        totalAmount: true,
        otp: true,
        cancellationReason: true,
        companion: {
          select: {
            id: true,
            user: {
              select: { username: true, profileImage: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({
      status: true,
      msg: "Client bookings fetched successfully",
      data: bookings
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};


/**
 * @Description Get companion bookings (history, upcoming, requests)
 * @Route GET /api/booking/companion?type=requests
 * @Access Private
 */
export const getCompanionBookings = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { type } = req.query;

  try {
    const companionProfile = await prisma.companionProfile.findFirst({
      where: { userId }
    });

    if (!companionProfile) {
      return res.status(404).json({ status: false, msg: "Companion profile not found" });
    }

    const whereClause: any = { companionId: companionProfile.id };

    if (type === 'requests') {
      whereClause.status = 'PENDING';
    } else if (type === 'upcoming') {
      whereClause.status = { in: ['ACCEPTED', 'ACTIVE'] };
    } else if (type === 'history') {
      whereClause.status = { in: ['COMPLETED', 'CANCELLED'] };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        date: true,
        startTime: true,
        endTime: true,
        address: true,
        totalAmount: true,
        otp: true,
        cancellationReason: true,
        client: {
          select: { id: true, username: true, profileImage: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return res.status(200).json({
      status: true,
      msg: "Companion bookings fetched successfully",
      data: bookings
    });
  } catch (error: any) {
    res.status(500).json({
      status: false,
      msg: error.message
    });
  }
};

/**
 * @Description Request to extend an active booking
 * @Route POST /api/booking/:id/request-extension
 * @Access Private
 */
export const requestExtension = async (req: Request, res: Response) => {
  const { id: clientId } = (req as any).user;
  const bookingId = parseInt(req.params.id);
  const { extensionHours } = req.body;

  if (!extensionHours || extensionHours <= 0) {
    return res.status(400).json({ status: false, msg: "Invalid extension hours" });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { companion: true }
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    if (booking.clientId !== clientId) {
      return res.status(403).json({ status: false, msg: "Unauthorized" });
    }

    if (booking.status !== 'ACTIVE' && booking.status !== 'PENDING') {
      return res.status(400).json({ status: false, msg: "Only active or pending bookings can be extended" });
    }

    if (booking.extensionStatus === 'PENDING') {
      return res.status(400).json({ status: false, msg: "An extension request is already pending" });
    }

    // Calculate extension amount based on companion's hourly rate
    const hourlyRate = booking.companion.hourlyRate || 0;
    const extensionAmount = hourlyRate * extensionHours;

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        extensionStatus: 'PENDING',
        extensionHours: extensionHours,
        extensionAmount: extensionAmount
      }
    });

    return res.status(200).json({
      status: true,
      msg: "Extension request sent to companion",
      data: updatedBooking
    });
  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Companion responds to an extension request
 * @Route POST /api/booking/:id/respond-extension
 * @Access Private
 */
export const respondToExtension = async (req: Request, res: Response) => {
  const { id: userId } = (req as any).user;
  const bookingId = parseInt(req.params.id);
  const { action } = req.body; // 'ACCEPT' or 'DENY'

  if (action !== 'ACCEPT' && action !== 'DENY') {
    return res.status(400).json({ status: false, msg: "Action must be ACCEPT or DENY" });
  }

  try {
    const companionProfile = await prisma.companionProfile.findUnique({ where: { userId } });
    if (!companionProfile) {
      return res.status(403).json({ status: false, msg: "Only companions can respond to extension requests" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    if (booking.companionId !== companionProfile.id) {
      return res.status(403).json({ status: false, msg: "Unauthorized" });
    }

    if (booking.extensionStatus !== 'PENDING') {
      return res.status(400).json({ status: false, msg: "No pending extension request for this booking" });
    }

    let updateData: any = {};

    if (action === 'ACCEPT') {
      // Calculate new end time
      const currentEndTime = new Date(booking.endTime);
      currentEndTime.setHours(currentEndTime.getHours() + (booking.extensionHours || 0));

      // Calculate new total amount
      const newTotalAmount = (booking.totalAmount || 0) + (booking.extensionAmount || 0);

      updateData = {
        extensionStatus: 'ACCEPTED',
        endTime: currentEndTime,
        totalAmount: newTotalAmount
      };
    } else {
      updateData = {
        extensionStatus: 'DENIED',
        extensionHours: null,
        extensionAmount: null
      };
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData
    });

    return res.status(200).json({
      status: true,
      msg: `Extension request ${action.toLowerCase()}ed`,
      data: updatedBooking
    });
  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};