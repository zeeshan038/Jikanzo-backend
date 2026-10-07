# Booking chat messaging

WhatsApp-style chat for a booking: **free text** and **images**, plus optional legacy **predefined catalog** messages (`docs/Jikanzo_Final_Predefined_Messaging_Developer_Spec.md`).

## When messaging is open

Same **coordination window** as voice calling (`docs/BOOKING_CALLING.md`):

- **Open:** `status` is `ACCEPTED` or `ACTIVE`, and current time is from **30 minutes before `startTime`** until **`endTime`**.
- **Closed:** before that window, after `endTime`, or when `CANCELLED` / `COMPLETED`.

## HTTP (Bearer auth)

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/messaging/catalog?page=1&limit=50` | Full library + aliases (paginated). With **`q`**: server search (max 4), same `messages` array shape (no `aliases` on hits). |
| GET | `/api/messaging/:id/status` | `{ available, reason, opensAt, closesAt }` — `:id` = booking id |
| GET | `/api/messaging/:id` | History + availability |
| GET | `/api/messaging/:id/quick-replies?forMessageId=` | Contextual replies |
| POST | `/api/messaging/:id/upload-image` | Multipart `image` → `{ imageUrl }` (booking must be ACCEPTED) |
| POST | `/api/messaging/:id` | Send free chat or legacy predefined |

**Send rules (free chat)**

- `{ text }` — plain message (max 4000 chars).
- `{ imageUrl }` or `{ text, imageUrl }` — photo (+ optional caption). URL must come from `POST .../upload-image` or `POST /api/user/upload-image`.
- `{ latitude, longitude, text? }` — share live location (optional caption).
- Do **not** mix `messageId` with free `text` / `imageUrl`.

**Send rules (legacy predefined, optional)**

- `{ messageId }` or `{ messageId: location_shared, latitude, longitude }` — unchanged catalog behavior.
- **POST response** may include `quickRepliesForReceiver` for predefined sends only.

## Realtime (Socket.io)

Same auth as booking sockets. Subscribe to the booking room:

```javascript
socket.emit('booking:subscribe', { bookingId: 123 });
```

| Event | Direction | Payload |
|-------|-----------|---------|
| `booking:message:new` | Server → client | `{ bookingId, message: { id, senderUserId, messageId, text, imageUrl, kind, latitude, longitude, createdAt } }` |
| `booking:messaging:closed` | Server → client | `{ bookingId, reason }` — window ended (cancel, complete, past `endTime`) |
| `booking:coordination:opened` | Server → client | `{ bookingId, available, opensAt, closesAt, … }` — ~30 min before start |
| `booking:coordination:closed` | Server → client | Same payload shape as messaging closed |

## Push (FCM only, no Notification table)

When someone sends a message, the **other** participant gets a device push if they have an `fcmToken` and are **not** currently subscribed to that booking’s socket room (`booking:subscribe` — i.e. chat open in app). Alert only; history stays in `BookingMessage`.

- **Title:** sender `username`
- **Body:** message text (or `Shared a location` for `location_shared`)
- **Data:** `type=BOOKING_MESSAGE`, `bookingId`, `bookingMessageId`, `messageId` — use to open the booking chat screen

Not written to the in-app notifications list.

## Mobile flow

1. Open booking messages → `GET /api/messaging/:id/status` and `GET /api/messaging/:id`.
2. `booking:subscribe` for live updates.
3. Send text → `POST /api/messaging/:id` with `{ text }`.
4. Send image → `POST /api/messaging/:id/upload-image` (multipart), then `POST /api/messaging/:id` with `{ imageUrl, text? }`.
5. Optional legacy: catalog search + `messageId` flow (see spec doc).
6. On `booking:messaging:closed`, disable composer; keep history visible.
