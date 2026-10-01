import { Request, Response } from 'express';
import prisma from '../../config/db';
import {
  CATALOG_VERSION,
  PREDEFINED_MESSAGES,
  getMessageById,
  getQuickRepliesForMessageId,
  isBookingMessagingAvailable,
  messagingUnavailableReason,
  searchPredefinedMessages,
} from '../../utils/predefinedMessaging';
import type { BookingMessageKind } from '../../utils/predefinedMessaging';
import { sendBookingMessageSchema } from '../../schema/user/bookingMessage';
import { emitBookingMessageNew, isUserInBookingChatRoom } from '../../sockets/bookingEmit';
import { sendFcmPushOnly } from '../../utils/notification';

const PUSH_BODY_MAX_LEN = 120;

async function pushBookingMessageToRecipient(params: {
  bookingId: number;
  senderUserId: number;
  recipientUserId: number;
  previewText: string;
  bookingMessageId: number;
  messageId: string;
}) {
  const { bookingId, senderUserId, recipientUserId, previewText, bookingMessageId, messageId } =
    params;

  if (isUserInBookingChatRoom(recipientUserId, bookingId)) {
    return;
  }

  const sender = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: { username: true },
  });
  const title = sender?.username?.trim() || 'New message';
  const body =
    messageId === 'location_shared'
      ? 'Shared a location'
      : previewText.length > PUSH_BODY_MAX_LEN
        ? `${previewText.slice(0, PUSH_BODY_MAX_LEN - 1)}…`
        : previewText;

  await sendFcmPushOnly(recipientUserId, title, body, {
    type: 'BOOKING_MESSAGE',
    bookingId: String(bookingId),
    bookingMessageId: String(bookingMessageId),
    messageId,
  });
}

async function loadBookingForMessaging(bookingId: number) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: { companion: { select: { userId: true } } },
  });
}

type BookingRow = NonNullable<Awaited<ReturnType<typeof loadBookingForMessaging>>>;

type BookingAccess =
  | { ok: false; status: number; msg: string }
  | { ok: true; booking: BookingRow; isClient: boolean; isCompanion: boolean };

async function assertBookingParticipant(bookingId: number, userId: number): Promise<BookingAccess> {
  const booking = await loadBookingForMessaging(bookingId);
  if (!booking) {
    return { ok: false, status: 404, msg: 'Booking not found' };
  }
  const companionProfile = await prisma.companionProfile.findFirst({ where: { userId } });
  const isClient = booking.clientId === userId;
  const isCompanion =
    companionProfile != null && booking.companionId === companionProfile.id;
  if (!isClient && !isCompanion) {
    return { ok: false, status: 403, msg: 'Unauthorized to access this booking' };
  }
  return { ok: true, booking, isClient, isCompanion };
}

function toKind(messageType: string, messageId: string, hasCoords: boolean): BookingMessageKind {
  if (messageId === 'location_shared' && hasCoords) return 'LOCATION_SHARED';
  if (messageType === 'quick_reply') return 'QUICK_REPLY';
  return 'MAIN';
}

function serializeMessage(row: {
  id: number;
  bookingId: number;
  senderUserId: number;
  messageId: string;
  text: string;
  kind: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    bookingId: row.bookingId,
    senderUserId: row.senderUserId,
    messageId: row.messageId,
    text: row.text,
    kind: row.kind,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.createdAt,
  };
}

/**
 * @Description Predefined message catalog for booking chat
 * @Route GET /api/messaging/catalog
 * @Access Private
 */
export const getMessageCatalog = async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (q) {
    const messages = searchPredefinedMessages(q).map(({ id, text, type }) => ({
      id,
      text,
      type,
    }));
    res.status(200).json({
      status: true,
      data: {
        version: CATALOG_VERSION,
        searchQuery: q,
        messages,
        pagination: {
          page: 1,
          limit: messages.length,
          total: messages.length,
          totalPages: 1,
          hasMore: false,
        },
      },
    });
    return;
  }

  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.floor(limitRaw), 1), 100)
    : 50;

  const all = PREDEFINED_MESSAGES.map(({ id, text, type, aliases }) => ({
    id,
    text,
    type,
    aliases,
  }));

  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const messages = all.slice(start, start + limit);

  res.status(200).json({
    status: true,
    data: {
      version: CATALOG_VERSION,
      messages,
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasMore: safePage < totalPages,
      },
    },
  });
};

/**
 * @Description Messaging availability for a booking
 * @Route GET /api/messaging/:id/status
 * @Access Private
 */
export const getMessagingStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const access = await assertBookingParticipant(bookingId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const available = isBookingMessagingAvailable(access.booking);
  res.status(200).json({
    status: true,
    data: {
      available,
      reason: available ? null : messagingUnavailableReason(access.booking),
    },
  });
};

/**
 * @Description List booking message history
 * @Route GET /api/messaging/:id
 * @Access Private
 */
export const listBookingMessages = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const access = await assertBookingParticipant(bookingId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 100;

  const messages = await prisma.bookingMessage.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  res.status(200).json({
    status: true,
    data: {
      available: isBookingMessagingAvailable(access.booking),
      reason: messagingUnavailableReason(access.booking),
      messages: messages.map(serializeMessage),
    },
  });
};

/**
 * @Description Contextual quick replies after a received message
 * @Route GET /api/messaging/:id/quick-replies
 * @Access Private
 */
export const getQuickReplies = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  const forMessageId = typeof req.query.forMessageId === 'string' ? req.query.forMessageId : '';

  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }
  if (!forMessageId) {
    res.status(400).json({ status: false, msg: 'forMessageId query is required' });
    return;
  }

  const access = await assertBookingParticipant(bookingId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  const replies = getQuickRepliesForMessageId(forMessageId).map(({ id, text, type }) => ({
    id,
    text,
    type,
  }));

  res.status(200).json({ status: true, data: { forMessageId, replies } });
};

/**
 * @Description Send a predefined booking message (canonical text only)
 * @Route POST /api/messaging/:id
 * @Access Private
 */
export const sendBookingMessage = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user.id;
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    res.status(400).json({ status: false, msg: 'Invalid booking id' });
    return;
  }

  const validation = sendBookingMessageSchema.validate(req.body);
  if (validation.error) {
    const msg = validation.error.details.map((d) => d.message).join(', ');
    res.status(400).json({ status: false, msg });
    return;
  }

  const access = await assertBookingParticipant(bookingId, userId);
  if (!access.ok) {
    res.status(access.status).json({ status: false, msg: access.msg });
    return;
  }

  if (!isBookingMessagingAvailable(access.booking)) {
    res.status(403).json({
      status: false,
      msg: messagingUnavailableReason(access.booking) ?? 'Messaging is closed',
      code: 'MESSAGING_CLOSED',
    });
    return;
  }

  const { messageId, latitude, longitude } = validation.value;
  const predefined = getMessageById(messageId);
  if (!predefined) {
    res.status(400).json({ status: false, msg: 'Unknown messageId. Only approved messages can be sent.' });
    return;
  }

  const hasCoords = latitude != null && longitude != null;
  if (messageId === 'location_shared') {
    if (!hasCoords) {
      res.status(400).json({
        status: false,
        msg: 'latitude and longitude are required when sharing location',
      });
      return;
    }
  } else if (hasCoords) {
    res.status(400).json({
      status: false,
      msg: 'Coordinates are only allowed for location_shared',
    });
    return;
  }

  const kind = toKind(predefined.type, messageId, hasCoords);

  const created = await prisma.bookingMessage.create({
    data: {
      bookingId,
      senderUserId: userId,
      messageId,
      text: predefined.text,
      kind,
      latitude: hasCoords ? latitude : null,
      longitude: hasCoords ? longitude : null,
    },
  });

  const payload = serializeMessage(created);
  emitBookingMessageNew(bookingId, payload).catch((err) =>
    console.error('[Socket] emitBookingMessageNew:', err)
  );

  const recipientUserId = access.isClient
    ? access.booking.companion?.userId
    : access.booking.clientId;
  if (recipientUserId != null && recipientUserId !== userId) {
    pushBookingMessageToRecipient({
      bookingId,
      senderUserId: userId,
      recipientUserId,
      previewText: predefined.text,
      bookingMessageId: created.id,
      messageId,
    }).catch((err) => console.error('[FCM] booking message push:', err));
  }

  const quickReplies = getQuickRepliesForMessageId(messageId).map(({ id, text, type }) => ({
    id,
    text,
    type,
  }));

  res.status(201).json({
    status: true,
    msg: 'Message sent',
    data: {
      message: payload,
      quickRepliesForReceiver: quickReplies,
    },
  });
};
