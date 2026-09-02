import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/db";

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const verifyUser = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded: any = jwt.verify(
        token,
        process.env.JWT_SECRET || "your_jwt_secret_key_here"
      );

      // Get user from the token
      const userId = decoded.id || decoded._id;
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: {
          id: true,
          username: true,
          phone: true,
          role: true,
          profileImage: true,
        },
      });

      if (!user) {
        return res.status(401).json({
          status: false,
          msg: "Not authorized, user not found"
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({
        status: false,
        msg: "Not authorized, token failed"
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      status: false,
      msg: "Not authorized, no token"
    });
  }
};
