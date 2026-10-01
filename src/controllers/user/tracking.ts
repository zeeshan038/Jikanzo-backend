import { Request, Response } from 'express';
import prisma from '../../config/db';
import {
  buildTrackingStatePayload,
  loadBookingForTracking,
  resolveTrackingRole,
} from '../../utils/bookingTracking';
import {
  joinTrackingSession,
  leaveTrackingSession,
} from '../../utils/bookingTrackingSession';
import { emitBookingTrackingState } from '../../sockets/bookingEmit';

/**
 * @Description Live tracking snapshot for a booking (client + companion positions)
 * @Route GET /api/booking/:id/tracking
 * @Access Private
 */
export const getBookingTracking = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });

  const booking = await loadBookingForTracking(bookingId);
  if (!booking) {
    res.status(404).json({ status: false, msg: 'Booking not found' });
    return;
  }

  const role = resolveTrackingRole(booking, userId, companionProfile?.id ?? null);
  if (!role) {
    res.status(403).json({ status: false, msg: 'Unauthorized to access this booking' });
    return;
  }

  res.status(200).json({
    status: true,
    data: buildTrackingStatePayload(booking),
  });
};

/**
 * @Description Join live tracking session (start sharing for current user)
 * @Route POST /api/booking/:id/tracking/join
 * @Access Private
 */
export const joinBookingTracking = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });

  const result = await joinTrackingSession(bookingId, userId, companionProfile?.id ?? null);
  if (!result.ok) {
    res.status(result.status).json({
      status: false,
      msg: result.msg,
      code: result.code,
    });
    return;
  }

  emitBookingTrackingState(bookingId, result.state);

  res.status(200).json({
    status: true,
    msg: 'Joined live tracking',
    data: result.state,
  });
};

/**
 * @Description Leave live tracking (stop sharing for current user)
 * @Route POST /api/booking/:id/tracking/leave
 * @Access Private
 */
export const leaveBookingTracking = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });

  const result = await leaveTrackingSession(bookingId, userId, companionProfile?.id ?? null);
  if (!result.ok) {
    res.status(result.status).json({ status: false, msg: result.msg });
    return;
  }

  emitBookingTrackingState(bookingId, result.state);

  res.status(200).json({
    status: true,
    msg: 'Left live tracking',
    data: result.state,
  });
};
