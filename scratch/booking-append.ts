
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
