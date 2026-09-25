import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import prisma from '../config/db';
import { authenticateSocket } from './auth';
import { emitInitialCompanionCount, setSocketServer } from './bookingEmit';
import { SOCKET_CLIENT_EVENTS } from './constants';
import { bookingRoom, companionRoom, userRoom } from './rooms';

export function initSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });

  setSocketServer(io);

  io.use(async (socket, next) => {
    const ok = await authenticateSocket(socket);
    if (!ok) {
      return next(new Error('Unauthorized'));
    }
    next();
  });

  io.on('connection', (socket) => {
    const { userId, companionProfileId } = socket.data;

    socket.join(userRoom(userId));
    if (companionProfileId != null) {
      socket.join(companionRoom(companionProfileId));
      void emitInitialCompanionCount(companionProfileId);
    }

    socket.on(SOCKET_CLIENT_EVENTS.BOOKING_SUBSCRIBE, async (payload: { bookingId?: number }) => {
      const bookingId = Number(payload?.bookingId);
      if (!Number.isFinite(bookingId)) {
        return;
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { clientId: true, companionId: true },
      });
      if (!booking) return;

      const isClient = booking.clientId === userId;
      const isCompanion = companionProfileId != null && booking.companionId === companionProfileId;
      if (!isClient && !isCompanion) return;

      socket.join(bookingRoom(bookingId));
    });

    socket.on(SOCKET_CLIENT_EVENTS.BOOKING_UNSUBSCRIBE, (payload: { bookingId?: number }) => {
      const bookingId = Number(payload?.bookingId);
      if (!Number.isFinite(bookingId)) return;
      socket.leave(bookingRoom(bookingId));
    });
  });

  console.log('[Socket.io] initialized');
  return io;
}

export { SOCKET_EVENTS, SOCKET_CLIENT_EVENTS } from './constants';
export {
  emitBookingRequestNew,
  emitBookingRequestUpdated,
  emitBookingRequestExpired,
} from './bookingEmit';
