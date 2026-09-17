import { Request, Response } from 'express';
import prisma from '../../config/db';


/**
 * @Description Initialize Companion Profile and upgrade role to BOTH
 * @Route POST /api/companion/become-companion
 * @Access Private
 */
export const becomeCompanion = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { companionProfile: true },
    });

    if (!user) {
      res.status(404).json({
        status: false,
        msg: 'User not found'
      });
      return;
    }

    if (user.companionProfile) {
      res.status(400).json({
        status: false,
        msg: 'User is already a companion'
      });
      return;
    }

    // Create the companion profile and update the user's role to BOTH
    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.companionProfile.create({
        data: {
          userId,
        },
      });

      return await tx.user.update({
        where: { id: userId },
        data: { role: 'BOTH' },
      });
    });

    res.status(200).json({
      status: true,
      msg: 'Successfully became a companion',
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: 'Internal server error'
    });
  }
};


/**
 * @Description Upgrade role to BOTH if they registered strictly as COMPANION
 * @Route POST /api/companion/become-client
 * @Access Private
 */
export const becomeClient = async (req: Request, res: Response): Promise<void> => {
   const userId = (req as any).user.id;
  try {
   
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({
        status: false,
        msg: 'User not found'
      });
      return;
    }

    if (user.role === 'CLIENT' || user.role === 'BOTH') {
      res.status(400).json({
        status: false,
        msg: 'User already has client access'
      });
      return;
    }

    // Update the user's role to BOTH
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'BOTH' },
    });

    res.status(200).json({
      status: true,
      msg: 'Successfully unlocked client mode',
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: 'Internal server error'
    });
  }
};


/**
 * @Description Toggle the companion's online status
 * @Route POST /api/companion/toggle-online-status
 * @Access Private
 */
export const toggleOnlineStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  try {

    const profile = await prisma.companionProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      res.status(404).json({
        status: false,
        msg: 'Companion profile not found'
      });
      return;
    }

    const updatedProfile = await prisma.companionProfile.update({
      where: { id: profile.id },
      data: { isOnline: !profile.isOnline },
    });

    res.status(200).json({
      status: true,
      msg: updatedProfile.isOnline ? 'You are now online' : 'You are now offline',
      data: { isOnline: updatedProfile.isOnline },
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      msg: 'Internal server error'
    });
  }
};
