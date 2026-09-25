import jwt from 'jsonwebtoken';
import { Socket } from 'socket.io';
import prisma from '../config/db';

declare module 'socket.io' {
  interface SocketData {
    userId: number;
    companionProfileId: number | null;
  }
}

export async function authenticateSocket(socket: Socket): Promise<boolean> {
  const token =
    (socket.handshake.auth?.token as string | undefined) ||
    (socket.handshake.query?.token as string | undefined);

  if (!token) {
    return false;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your_jwt_secret_key_here'
    ) as { id?: number; _id?: number };

    const userId = Number(decoded.id ?? decoded._id);
    if (!Number.isFinite(userId)) {
      return false;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, currentToken: true },
    });

    if (!user || user.currentToken !== token) {
      return false;
    }

    const companionProfile = await prisma.companionProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    socket.data = {
      userId: user.id,
      companionProfileId: companionProfile?.id ?? null,
    };

    return true;
  } catch {
    return false;
  }
}
