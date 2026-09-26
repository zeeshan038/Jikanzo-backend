import { Request, Response } from "express";
import prisma from "../../config/db";
import {
  createBooking,
  acceptBooking,
  cancelBookingSchema,
  rescheduleBookingSchema,
  verifyBookingOtpSchema,
} from "../../schema/user/booking";
import { payWithWalletSchema } from '../../schema/user/wallet';
import { calculateJSS } from "../../utils/jssCalculator";
import { BOOKING_CANCEL_REASONS, isValidCancelReasonCode } from "../../constants/bookingCancelReasons";
import { chargeBookingFromWallet } from "../../utils/bookingWallet";
import {
  BOOKING_REQUEST_EXPIRY_MS,
  bookingDetailInclude,
  buildClientSummary,
  buildCompanionBookingDetailProfile,
  listBookingSelect,
  normalizeBookingListType,
  recalculateBookingAmount,
} from "../../utils/bookingHelpers";
import {
  emitBookingRequestNew,
  emitBookingRequestUpdated,
} from "../../sockets";
import { getStoredOrComputedBreakdown } from "../../utils/bookingFinance";

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

    const startDate = new Date(payload.startTime);
    const endDate = new Date(payload.endTime);
    // Calculate duration in hours
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs > 0 ? durationMs / (1000 * 60 * 60) : 0;

    const hourlyRate = companion.hourlyRate || 0;
    const amounts = recalculateBookingAmount(hourlyRate, startDate, endDate);

    const booking = await prisma.booking.create({
      data: {
        clientId,
        companionId: Number(companionId),
        date: new Date(payload.date),
        startTime: startDate,
        endTime: endDate,
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
        activity: payload.activity,
        totalAmount: amounts.totalAmount,
        grossAmount: amounts.grossAmount,
        platformFee: amounts.platformFee,
        companionNetAmount: amounts.companionNetAmount,
        status: "PENDING",
        otpVerified: false,
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
          { bookingId: booking.id },
          "NEW_BOOKING_REQUEST"
        );
      }
    }).catch(err => console.error("Failed to send notification:", err));

    emitBookingRequestNew(booking.id, Number(companionId)).catch((err) =>
      console.error("[Socket] emitBookingRequestNew:", err)
    );

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

    if (booking.companion.userId !== (req as any).user?.id) {
      return res.status(403).json({
        status: false,
        msg: "Only the assigned companion can accept or decline this booking",
      });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        status: false,
        msg: "Only pending booking requests can be accepted or declined",
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

    emitBookingRequestUpdated(bookingId).catch((err) =>
      console.error("[Socket] emitBookingRequestUpdated:", err)
    );

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

    const grossAmount = booking.totalAmount || 0;
    if (grossAmount <= 0) {
      return res.status(400).json({ status: false, msg: "Invalid booking amount" });
    }

    if (booking.clientId !== userId) {
      return res.status(403).json({ status: false, msg: "Only the client can pay for this booking" });
    }

    const companion = await prisma.companionProfile.findUnique({
      where: { id: booking.companionId },
    });

    if (!companion) {
      return res.status(404).json({ status: false, msg: "Companion not found" });
    }

    let paymentBreakdown;
    try {
      const { breakdown } = await chargeBookingFromWallet({
        clientUserId: userId,
        companionUserId: companion.userId,
        bookingId: booking.id,
        grossAmount,
        clientDescription: `Paid for booking #${booking.id}`,
        companionDescription: `Received payment for booking #${booking.id}`,
      });
      paymentBreakdown = breakdown;

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'PAID',
          grossAmount: breakdown.grossAmount,
          platformFee: breakdown.platformFee,
          companionNetAmount: breakdown.companionNetAmount,
        },
      });
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ status: false, msg: "Insufficient wallet balance" });
      }
      throw err;
    }

    res.status(200).json({
      status: true,
      msg: "Payment successful",
      data: {
        bookingId,
        paymentStatus: 'PAID',
        amountDeducted: grossAmount,
        paymentSummary: paymentBreakdown,
      },
    });

  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

async function resolveBookingParticipant(bookingId: number, userId: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingDetailInclude,
  });
  if (!booking) {
    return { error: { status: 404, msg: "Booking not found" } as const };
  }
  const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });
  const isClient = booking.clientId === userId;
  const isCompanion = companionProfile?.id === booking.companionId;
  if (!isClient && !isCompanion) {
    return { error: { status: 403, msg: "Unauthorized to access this booking" } as const };
  }
  return { booking, isClient, isCompanion };
}

/**
 * @Description Get client bookings (history, upcoming, requests)
 * @Route GET /api/booking/client?type=requests
 * @Access Private
 */
export const getClientBookings = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const listType = normalizeBookingListType(req.query.type);

  try {
    const whereClause: any = { clientId: userId };

    if (listType === 'requests') {
      whereClause.status = 'PENDING';
    } else if (listType === 'upcoming') {
      whereClause.status = { in: ['ACCEPTED', 'ACTIVE'] };
    } else if (listType === 'history') {
      whereClause.status = { in: ['COMPLETED', 'CANCELLED'] };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      select: listBookingSelect,
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
  const listType = normalizeBookingListType(req.query.type);

  try {
    const companionProfile = await prisma.companionProfile.findFirst({
      where: { userId }
    });

    if (!companionProfile) {
      return res.status(404).json({ status: false, msg: "Companion profile not found" });
    }

    const whereClause: any = { companionId: companionProfile.id };

    if (listType === 'requests') {
      whereClause.status = 'PENDING';
    } else if (listType === 'upcoming') {
      whereClause.status = { in: ['ACCEPTED', 'ACTIVE'] };
    } else if (listType === 'history') {
      whereClause.status = { in: ['COMPLETED', 'CANCELLED'] };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      select: listBookingSelect,
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
 * @Route POST /api/booking/request-extension/:id
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
 * @Route POST /api/booking/respond-extension/:id
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
      where: { id: bookingId },
      include: { companion: true },
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
      const extensionGross = booking.extensionAmount || 0;
      if (extensionGross > 0) {
        try {
          await chargeBookingFromWallet({
            clientUserId: booking.clientId,
            companionUserId: booking.companion.userId,
            bookingId: booking.id,
            grossAmount: extensionGross,
            clientDescription: `Extension payment for booking #${booking.id}`,
            companionDescription: `Extension earnings for booking #${booking.id}`,
          });
        } catch (err: any) {
          if (err.message === 'INSUFFICIENT_BALANCE') {
            return res.status(400).json({
              status: false,
              msg: "Client has insufficient wallet balance for the extension",
            });
          }
          throw err;
        }
      }

      const currentEndTime = new Date(booking.endTime);
      currentEndTime.setHours(currentEndTime.getHours() + (booking.extensionHours || 0));

      const hourlyRate = booking.companion.hourlyRate || 0;
      const amounts = recalculateBookingAmount(hourlyRate, booking.startTime, currentEndTime);

      updateData = {
        extensionStatus: 'ACCEPTED',
        extensionPaymentStatus: extensionGross > 0 ? 'PAID' : booking.extensionPaymentStatus,
        endTime: currentEndTime,
        totalAmount: amounts.totalAmount,
        grossAmount: amounts.grossAmount,
        platformFee: amounts.platformFee,
        companionNetAmount: amounts.companionNetAmount,
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

/**
 * @Description Start a booking
 * @Route POST /api/booking/start/:id
 * @Access Private
 */
export const startBookingController = async (req: Request, res: Response) => {
  const { id: userId } = (req as any).user;
  const bookingId = parseInt(req.params.id);

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { companion: true }
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });
    const isClient = booking.clientId === userId;
    const isCompanion = companionProfile && booking.companionId === companionProfile.id;

    if (!isClient && !isCompanion) {
      return res.status(403).json({
        status: false,
        msg: "Unauthorized to start this booking."
      });
    }

    if (booking.status !== 'ACCEPTED') {
      return res.status(400).json({ 
        status: false,
         msg: "Only accepted bookings can be started." });
    }

    if (!booking.otpVerified) {
      return res.status(400).json({
        status: false,
        msg: "Booking OTP must be verified before starting the session",
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'ACTIVE' }
    });

    return res.status(200).json({
      status: true,
      msg: "Booking started successfully",
      data: updatedBooking
    });
  } catch (error: any) {
    res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description List predefined booking cancellation reasons
 * @Route GET /api/booking/cancel-reasons
 * @Access Private
 */
export const getCancelReasons = async (_req: Request, res: Response) => {
  return res.status(200).json({
    status: true,
    msg: "Cancellation reasons fetched successfully",
    data: BOOKING_CANCEL_REASONS,
  });
};

/**
 * @Description Get single booking details for detail screens
 * @Route GET /api/booking/detail/:id
 * @Access Private
 */
export const getBookingById = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const bookingId = parseInt(req.params.id, 10);

  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ status: false, msg: "Invalid booking id" });
  }

  try {
    const result = await resolveBookingParticipant(bookingId, userId);
    if ("error" in result && result.error) {
      return res.status(result.error.status).json({ status: false, msg: result.error.msg });
    }

    const { booking, isClient, isCompanion } = result as Exclude<typeof result, { error: unknown }>;
    const expiresAt = new Date(booking.createdAt.getTime() + BOOKING_REQUEST_EXPIRY_MS);

    const payload: Record<string, unknown> = {
      id: booking.id,
      status: booking.status,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      latitude: booking.latitude,
      longitude: booking.longitude,
      address: booking.address,
      activity: booking.activity,
      paymentStatus: booking.paymentStatus,
      extensionStatus: booking.extensionStatus,
      extensionHours: booking.extensionHours,
      extensionAmount: booking.extensionAmount,
      extensionPaymentStatus: booking.extensionPaymentStatus,
      cancellationReason: booking.cancellationReason,
      cancellationReasonCode: booking.cancellationReasonCode,
      otpVerified: booking.otpVerified,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      requestExpiresAt: booking.status === "PENDING" ? expiresAt : null,
      client: buildClientSummary(booking),
      companionProfile: buildCompanionBookingDetailProfile(booking),
    };

    if (isClient && ["ACCEPTED", "ACTIVE"].includes(booking.status)) {
      payload.otp = booking.otp;
    }

    return res.status(200).json({
      status: true,
      msg: "Booking fetched successfully",
      data: {
        ...payload,
        viewerRole:
          isClient && isCompanion ? "BOTH" : isClient ? "CLIENT" : isCompanion ? "COMPANION" : "UNKNOWN",
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};


/**
 * @Description Payment receipt with platform fee breakdown
 * @Route GET /api/booking/receipt/:id
 * @Access Private
 */
export const getBookingReceipt = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const bookingId = parseInt(req.params.id, 10);

  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ status: false, msg: "Invalid booking id" });
  }

  try {
    const result = await resolveBookingParticipant(bookingId, userId);
    if ("error" in result && result.error) {
      return res.status(result.error.status).json({ status: false, msg: result.error.msg });
    }

    const { booking, isClient, isCompanion } = result as Exclude<typeof result, { error: unknown }>;

    if (booking.paymentStatus !== "PAID") {
      return res.status(400).json({ status: false, msg: "Receipt is available only for paid bookings" });
    }

    const breakdown = getStoredOrComputedBreakdown(booking);
    const transactions = await prisma.walletTransaction.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({
      status: true,
      msg: "Booking receipt fetched successfully",
      data: {
        bookingId: booking.id,
        currency: process.env.BOOKING_CURRENCY || "USD",
        grossBookingPrice: breakdown.grossAmount,
        platformFee: breakdown.platformFee,
        platformFeePercent: breakdown.platformFeePercent,
        totalCreditedAmount: breakdown.companionNetAmount,
        paymentStatus: booking.paymentStatus,
        viewerRole:
          isClient && isCompanion ? "BOTH" : isClient ? "CLIENT" : isCompanion ? "COMPANION" : "UNKNOWN",
        transactions,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Cancel a booking with a reason code
 * @Route POST /api/booking/cancel/:id
 * @Access Private
 */
export const cancelBookingController = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const bookingId = parseInt(req.params.id, 10);
  const validation = cancelBookingSchema.validate(req.body);

  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ status: false, msg: "Invalid booking id" });
  }

  if (validation.error) {
    const errors = validation.error.details.map((d: any) => d.message).join(",");
    return res.status(400).json({ status: false, msg: errors });
  }

  const { reasonCode, reasonText } = validation.value;
  if (!isValidCancelReasonCode(reasonCode)) {
    return res.status(400).json({ status: false, msg: "Invalid cancellation reason code" });
  }
  if (reasonCode === "OTHER" && !reasonText?.trim()) {
    return res.status(400).json({ status: false, msg: "reasonText is required when reasonCode is OTHER" });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { companion: true },
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });
    const isClient = booking.clientId === userId;
    const isCompanion = companionProfile?.id === booking.companionId;

    if (!isClient && !isCompanion) {
      return res.status(403).json({ status: false, msg: "Unauthorized to cancel this booking" });
    }

    if (!["PENDING", "ACCEPTED", "ACTIVE"].includes(booking.status)) {
      return res.status(400).json({ status: false, msg: "This booking cannot be cancelled" });
    }

    const label = BOOKING_CANCEL_REASONS.find((r) => r.code === reasonCode)?.label || reasonCode;
    const cancellationReason =
      reasonCode === "OTHER" ? reasonText!.trim() : `${label}${reasonText ? `: ${reasonText}` : ""}`;

    const updateData: any = {
      status: "CANCELLED",
      cancelledById: userId,
      cancellationReasonCode: reasonCode,
      cancellationReason,
    };

    if (isCompanion && booking.status !== "PENDING") {
      await prisma.companionProfile.update({
        where: { id: booking.companionId },
        data: { reliabilityScore: { decrement: 10 } },
      });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
    });

    if (booking.status !== "PENDING") {
      calculateJSS(booking.companionId).catch((err) => console.error("JSS Calculation Error:", err));
    }

    emitBookingRequestUpdated(bookingId).catch((err) =>
      console.error("[Socket] emitBookingRequestUpdated:", err)
    );

    return res.status(200).json({
      status: true,
      msg: "Booking cancelled successfully",
      data: updatedBooking,
    });
  } catch (error: any) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};

/**
 * @Description Reschedule a booking (client only, before session starts)
 * @Route PATCH /api/booking/reschedule/:id
 * @Access Private
 */
export const rescheduleBookingController = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const bookingId = parseInt(req.params.id, 10);
  const validation = rescheduleBookingSchema.validate(req.body);

  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ status: false, msg: "Invalid booking id" });
  }

  if (validation.error) {
    const errors = validation.error.details.map((d: any) => d.message).join(",");
    return res.status(400).json({ status: false, msg: errors });
  }

  const payload = validation.value;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { companion: true },
    });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    if (booking.clientId !== userId) {
      return res.status(403).json({ status: false, msg: "Only the client can reschedule this booking" });
    }

    if (!["PENDING", "ACCEPTED"].includes(booking.status)) {
      return res.status(400).json({ status: false, msg: "Only pending or accepted bookings can be rescheduled" });
    }

    if (booking.paymentStatus === "PAID") {
      return res.status(400).json({
        status: false,
        msg: "Paid bookings cannot be rescheduled. Cancel and create a new booking instead.",
      });
    }

    const startDate = new Date(payload.startTime);
    const endDate = new Date(payload.endTime);
    const hourlyRate = booking.companion.hourlyRate || 0;
    const amounts = recalculateBookingAmount(hourlyRate, startDate, endDate);

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        date: new Date(payload.date),
        startTime: startDate,
        endTime: endDate,
        latitude: payload.latitude ?? booking.latitude,
        longitude: payload.longitude ?? booking.longitude,
        address: payload.address ?? booking.address,
        activity: payload.activity ?? booking.activity,
        totalAmount: amounts.totalAmount,
        grossAmount: amounts.grossAmount,
        platformFee: amounts.platformFee,
        companionNetAmount: amounts.companionNetAmount,
        status: "PENDING",
        extensionStatus: "NONE",
        extensionHours: null,
        extensionAmount: null,
        extensionPaymentStatus: "PENDING",
        otpVerified: false,
      },
    });

    emitBookingRequestUpdated(bookingId).catch((err) =>
      console.error("[Socket] emitBookingRequestUpdated:", err)
    );

    return res.status(200).json({
      status: true,
      msg: "Booking rescheduled successfully"
    });
  } catch (error: any) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};


/**
 * @Description Verify booking OTP before starting the session
 * @Route POST /api/booking/verify-otp/:id
 * @Access Private
 */
export const verifyBookingOtpController = async (req: Request, res: Response) => {
  const userId = (req as any).user.id;
  const bookingId = parseInt(req.params.id, 10);
  const validation = verifyBookingOtpSchema.validate(req.body);

  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ status: false, msg: "Invalid booking id" });
  }

  if (validation.error) {
    const errors = validation.error.details.map((d: any) => d.message).join(",");
    return res.status(400).json({ status: false, msg: errors });
  }

  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

    if (!booking) {
      return res.status(404).json({ status: false, msg: "Booking not found" });
    }

    if (booking.clientId !== userId) {
      return res.status(403).json({ status: false, msg: "Only the client can verify the booking OTP" });
    }

    if (!["ACCEPTED", "ACTIVE"].includes(booking.status)) {
      return res.status(400).json({ status: false, msg: "OTP can be verified for accepted or active bookings only" });
    }

    if (booking.otp !== validation.value.otp) {
      return res.status(400).json({ status: false, msg: "Invalid OTP provided" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { otpVerified: true },
    });

    return res.status(200).json({
      status: true,
      msg: "Booking OTP verified successfully",
      data: { id: updatedBooking.id, otpVerified: updatedBooking.otpVerified },
    });
  } catch (error: any) {
    return res.status(500).json({ status: false, msg: error.message });
  }
};