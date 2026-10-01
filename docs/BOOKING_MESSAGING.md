# Booking predefined messaging (Phase 1)

Controlled chat for a booking: users **search** flexible text but the server only sends **canonical `messageId`** strings from the catalog (`docs/Jikanzo_Final_Predefined_Messaging_Developer_Spec.md`).

## When messaging is open

- **Open:** `status === ACCEPTED` (payment not required until payment module is live)
- **Closed:** session start (`status === ACTIVE`), cancelled, etc.

## HTTP (Bearer auth)

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/messaging/catalog?page=1&limit=50` | Full library + aliases (paginated). With **`q`**: server search (max 4), same `messages` array shape (no `aliases` on hits). |
| GET | `/api/messaging/:id/status` | `{ available, reason }` — `:id` = booking id |
| GET | `/api/messaging/:id` | History + availability |
| GET | `/api/messaging/:id/quick-replies?forMessageId=` | Contextual replies |
| POST | `/api/messaging/:id` | Send `{ messageId, latitude?, longitude? }` |

**Send rules**

- Body must include **`messageId` only** (no free-text).
- **`location_shared`** requires both `latitude` and `longitude`.
- Other messages must not include coordinates.

**POST response** includes `quickRepliesForReceiver` for the **other** party’s UI.

## Realtime (Socket.io)

Same auth as booking sockets. Subscribe to the booking room:

```javascript
socket.emit('booking:subscribe', { bookingId: 123 });
```

| Event | Direction | Payload |
|-------|-----------|---------|
| `booking:message:new` | Server → client | `{ bookingId, message: { id, senderUserId, messageId, text, kind, latitude, longitude, createdAt } }` |
| `booking:messaging:closed` | Server → client | `{ bookingId, reason }` — emitted when session starts (`POST /api/booking/start/:id`) |

## Push (FCM only, no Notification table)

When someone sends a message, the **other** participant gets a device push if they have an `fcmToken` and are **not** currently subscribed to that booking’s socket room (`booking:subscribe` — i.e. chat open in app). Alert only; history stays in `BookingMessage`.

- **Title:** sender `username`
- **Body:** message text (or `Shared a location` for `location_shared`)
- **Data:** `type=BOOKING_MESSAGE`, `bookingId`, `bookingMessageId`, `messageId` — use to open the booking chat screen

Not written to the in-app notifications list.

## Mobile flow

1. Open booking messages → `GET /api/messaging/:id/status` and `GET /api/messaging/:id`.
2. `booking:subscribe` for live updates.
3. Search → `GET /api/messaging/catalog?q=...` (or cache full catalog via paginated `catalog` without `q`).
4. Send → `POST /api/messaging/:id` with selected `messageId`.
5. On receive → `GET .../quick-replies?forMessageId=` or use `quickRepliesForReceiver` from POST ack.
6. Location: send quick reply `qr_share_my_location`, confirm on device, then `POST` with `messageId: location_shared` + coords.
7. On `booking:messaging:closed`, disable search; keep history visible.
