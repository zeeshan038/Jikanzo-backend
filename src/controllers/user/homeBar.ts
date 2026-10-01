import { Request, Response } from 'express';
import { resolveHomeBarForUser } from '../../utils/bookingHomeBar';

/**
 * @Description Home / feed blue bar — upcoming booking within 30 min + OTP
 * @Route GET /api/booking/home-bar
 * @Access Private
 */
export const getHomeBookingBar = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const data = await resolveHomeBarForUser(userId);
  res.status(200).json({ status: true, data });
};
