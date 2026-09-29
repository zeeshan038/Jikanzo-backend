import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import type { AdminJwtPayload } from '../utils/methods';

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: number;
        email: string;
        name: string | null;
        role: string;
      };
    }
  }
}

export const verifyAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ status: false, msg: 'Not authorized, no token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_jwt_secret_key_here'
    ) as AdminJwtPayload;

    if (decoded.type !== 'admin') {
      return res.status(401).json({ status: false, msg: 'Not authorized, invalid admin token' });
    }

    const adminId = parseInt(decoded._id, 10);
    if (Number.isNaN(adminId)) {
      return res.status(401).json({ status: false, msg: 'Not authorized, token failed' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        currentToken: true,
      },
    });

    if (!admin || !admin.isActive) {
      return res.status(401).json({ status: false, msg: 'Not authorized, admin not found' });
    }

    if (admin.currentToken !== token) {
      return res.status(401).json({
        status: false,
        msg: 'Session expired. Logged in from another device.',
      });
    }

    const adminSession = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
    req.admin = adminSession;
    req.user = { ...(req.user as object), admin: adminSession };
    next();
  } catch {
    return res.status(401).json({ status: false, msg: 'Not authorized, token failed' });
  }
};

/** Require one of the listed admin roles (use after verifyAdmin). */
export const requireAdminRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return res.status(401).json({ status: false, msg: 'Not authorized' });
    }
    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({ status: false, msg: 'Insufficient permissions' });
    }
    next();
  };
};
