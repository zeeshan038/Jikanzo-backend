# Booking sockets — simple guide for frontend

This file explains **everything** about real-time booking updates using **Socket.io**.

Read this top to bottom once. Then use the **Event list** section as your cheat sheet while coding.

---

## 1. What is this for?

When a **client** books a **companion**:

- The companion should see **“8 new requests”** update live.
- The **Accept / Deny popup** should open live (without refreshing the app).
- When someone **accepts**, **declines**, **cancels**, or the request **expires**, both sides should see updates live.

**Important:** The app still **calls normal HTTP APIs** to do actions (book, accept, cancel). Sockets only **tell the app that something changed** and send **data to show on screen**.

Sockets do **not** replace:

- `POST /api/booking/book-companion/:id`
- `POST /api/booking/accept`
- `GET /api/booking/detail/:id`

---

## 2. How to connect (one time after login)

Use the **same API base URL** as your REST calls.

| What | Exact value |
|------|-------------|
| URL | Your API host, e.g. `https://transfer.jikanzo.com` or `http://localhost:3000` |
| Socket path | `/socket.io` |
| npm package | `socket.io-client` (version 4) |

Pass the **same login token (JWT)** you use for `Authorization: Bearer ...` on APIs.

```javascript
import { io } from 'socket.io-client';

const socket = io('https://YOUR_API_HOST', {
  path: '/socket.io',
  auth: { token: userJwtToken },
});
```

If `auth` does not work on your platform, you can use:

```javascript
query: { token: userJwtToken }
```

**When connection works:** you will see a normal `connect` event from the library.

**When connection fails:** you get `connect_error`. Common reasons:

- Wrong or expired token
- User logged in on another phone (server only allows one active token)

**Who should connect?**

- **Companion** — must connect on home / dashboard (to see new requests).
- **Client** — should connect when waiting for accept/decline or on booking screens.

After login → connect socket. On logout → disconnect socket.

---

## 3. What the server does automatically (you do not code this)

When you connect, the server puts your socket in rooms:

| Room name (internal) | You get it if… | Why |
|----------------------|----------------|-----|
| `user:{yourUserId}` | Always | Client gets updates about their bookings |
| `companion:{companionProfileId}` | You have a companion profile | New requests + pending count |

You **do not** need to join these rooms yourself.

---

## 4. Full list of events (quick table)

### Messages **from server to app** (you **listen** with `socket.on`)

| # | Exact event name | Mainly for |
|---|------------------|------------|
| 1 | `booking:requests:count` | Companion — banner “N new requests” |
| 2 | `booking:request:new` | Companion — open Accept/Deny popup |
| 3 | `booking:request:updated` | Client + companion — status changed |
| 4 | `booking:request:expired` | Client + companion — request timed out |

### Messages **from app to server** (you **send** with `socket.emit`)

| # | Exact event name | When to send |
|---|------------------|--------------|
| 5 | `booking:subscribe` | User opened one booking detail screen |
| 6 | `booking:unsubscribe` | User left that screen |

There are **only these 6 event names** for booking today. No other booking socket events exist yet.

---

## 5. Event details (exact name + body + plain English)

---

### Event 1: `booking:requests:count`

**Direction:** Server → your app  

**Who should listen:** **Companion only** (user with companion profile).

**When does the server send it?**

- Right after companion connects.
- After a new booking arrives.
- After accept, decline, cancel, reschedule, or auto-expire (anything that changes how many **PENDING** requests exist).

**Exact payload (JSON body):**

```json
{
  "pendingCount": 8
}
```

**What each field means:**

| Field | Type | Meaning |
|-------|------|---------|
| `pendingCount` | number | How many booking requests are **PENDING** for this companion right now. Use this for the banner text like “8 New request”. |

**What to do in the app:**

- Update the orange banner number on the companion dashboard.
- You do **not** need to call the dashboard API every time if the socket is connected (still refresh once on app open / reconnect).

---

### Event 2: `booking:request:new`

**Direction:** Server → your app  

**Who should listen:** **Companion only**.

**When does the server send it?**

- Client successfully created a booking: `POST /api/booking/book-companion/:companionProfileId`.

**Exact payload (JSON body):**

```json
{
  "bookingId": 123,
  "pendingCount": 8,
  "preview": {
    "id": 123,
    "status": "PENDING",
    "date": "2026-07-23T00:00:00.000Z",
    "startTime": "2026-07-23T00:00:00.000Z",
    "endTime": "2026-07-23T02:00:00.000Z",
    "address": "Nwab Restaurant",
    "activity": "Fine Dining",
    "paymentStatus": "PENDING",
    "createdAt": "2026-07-22T12:00:00.000Z",
    "requestExpiresAt": "2026-07-22T12:30:00.000Z",
    "client": {
      "id": 45,
      "username": "elena_r",
      "profileImage": "https://example.com/photo.jpg",
      "age": 28
    },
    "paymentSummary": {
      "durationHours": 1,
      "durationLabel": "1 Hour",
      "hourlyRate": 40,
      "currency": "USD",
      "paymentStatus": "PENDING",
      "grossAmount": 40,
      "platformFee": 4,
      "companionNetAmount": 36,
      "platformFeePercent": 10,
      "expectedCompanionEarnings": 36
    }
  }
}
```

**Note:** `preview` can be `null` if something went wrong loading data (rare). If null, open popup and load `GET /api/booking/detail/:bookingId`.

**Top level fields:**

| Field | Type | Meaning |
|-------|------|---------|
| `bookingId` | number | Same as booking id. Use for accept API and detail API. |
| `pendingCount` | number | Same as event 1 — update banner. |
| `preview` | object or null | All UI data for the popup (see below). |

**Inside `preview`:**

| Field | Type | Meaning |
|-------|------|---------|
| `id` | number | Booking id |
| `status` | string | Usually `"PENDING"` for new requests |
| `date` | string (ISO date) | Booking day |
| `startTime` | string (ISO datetime) | Session start |
| `endTime` | string (ISO datetime) | Session end |
| `address` | string | Location name / address |
| `activity` | string | e.g. `"Fine Dining"`, `"Coffee"` |
| `paymentStatus` | string | e.g. `"PENDING"`, `"PAID"` |
| `createdAt` | string (ISO datetime) | When client sent the request |
| `requestExpiresAt` | string or null | When the request auto-expires if companion does not answer (**30 minutes** after `createdAt` while still PENDING). Use for countdown timer. |

**Inside `preview.client` (person who booked):**

| Field | Type | Meaning |
|-------|------|---------|
| `id` | number | Client user id |
| `username` | string | Show as name on popup |
| `profileImage` | string or null | Avatar URL |
| `age` | number or null | Show age if you want “Elena, 28” |

**Inside `preview.paymentSummary` (money / duration on popup):**

| Field | Type | Meaning |
|-------|------|---------|
| `durationHours` | number | Length in hours (e.g. `1`) |
| `durationLabel` | string | Ready text: `"1 Hour"` or `"2 Hours"` |
| `hourlyRate` | number | Companion rate used for this booking |
| `currency` | string | Usually `"USD"` |
| `paymentStatus` | string | Payment state for this booking |
| `grossAmount` | number | Total before platform fee |
| `platformFee` | number | App fee amount |
| `companionNetAmount` | number | What companion earns after fee |
| `platformFeePercent` | number | Fee % (often `10`) |
| `expectedCompanionEarnings` | number | Same idea as net — show as “Expected earnings” on popup |

**What to do in the app:**

1. Open the **Booking Request** modal.
2. Fill all labels from `preview`.
3. Start countdown from `requestExpiresAt`.
4. Update banner with `pendingCount`.
5. **Accept** and **Deny** buttons still call HTTP API (see section 8), not a socket.

**Push notification (separate from socket):**

If app is in background, companion also gets FCM with `bookingId`. When user taps notification, open the same popup and optionally call detail API.

---

### Event 3: `booking:request:updated`

**Direction:** Server → your app  

**Who should listen:** **Client and companion** (both).

**When does the server send it?**

| What happened | HTTP API that triggers it |
|---------------|---------------------------|
| Companion accepted or declined | `POST /api/booking/accept` |
| Someone cancelled | `POST /api/booking/cancel/:id` |
| Client rescheduled | `PATCH /api/booking/reschedule/:id` |

**Not sent yet** when client pays, starts session, verifies OTP, completes, or extension — only refresh with REST for those until backend adds more events.

**Exact payload (JSON body):**

```json
{
  "bookingId": 123,
  "id": 123,
  "status": "ACCEPTED",
  "date": "2026-07-23T00:00:00.000Z",
  "startTime": "2026-07-23T00:00:00.000Z",
  "endTime": "2026-07-23T02:00:00.000Z",
  "address": "Nwab Restaurant",
  "activity": "Fine Dining",
  "paymentStatus": "PENDING",
  "extensionStatus": "NONE",
  "cancellationReason": null,
  "cancellationReasonCode": null,
  "createdAt": "2026-07-22T12:00:00.000Z",
  "updatedAt": "2026-07-22T12:05:00.000Z",
  "requestExpiresAt": null,
  "client": {
    "id": 45,
    "username": "elena_r",
    "profileImage": "https://example.com/photo.jpg",
    "age": 28
  },
  "companionProfile": {
    "id": 1,
    "bio": "Hello",
    "hourlyRate": 40,
    "rating": 4.5,
    "trustRank": "GOLD",
    "totalSessions": 10,
    "repeatClients": 3,
    "jssScore": 80,
    "completedMeetups": 8,
    "reliabilityScore": 90,
    "user": {
      "id": 12,
      "username": "companion_name",
      "profileImage": "https://example.com/c.jpg",
      "age": 25,
      "languages": ["English"],
      "activityType": ["Coffee"],
      "about": "About text",
      "gallery": []
    }
  },
  "paymentSummary": {
    "durationHours": 1,
    "durationLabel": "1 Hour",
    "hourlyRate": 40,
    "currency": "USD",
    "paymentStatus": "PENDING",
    "grossAmount": 40,
    "platformFee": 4,
    "companionNetAmount": 36,
    "platformFeePercent": 10,
    "expectedCompanionEarnings": 36
  }
}
```

**Field meanings (booking level):**

| Field | Type | Meaning |
|-------|------|---------|
| `bookingId` | number | Booking id (duplicate of `id` for convenience) |
| `id` | number | Booking id |
| `status` | string | e.g. `PENDING`, `ACCEPTED`, `CANCELLED`, `ACTIVE`, `COMPLETED` |
| `date` | string | Booking date |
| `startTime` | string | Start time |
| `endTime` | string | End time |
| `address` | string | Location |
| `activity` | string | Activity type |
| `paymentStatus` | string | Payment state |
| `extensionStatus` | string | Extension flow state (often `"NONE"`) |
| `cancellationReason` | string or null | Human-readable cancel reason if cancelled |
| `cancellationReasonCode` | string or null | Code if cancelled via cancel API |
| `createdAt` | string | Created time |
| `updatedAt` | string | Last update time |
| `requestExpiresAt` | string or null | Countdown end while `PENDING`; otherwise `null` |
| `client` | object | Client summary (same fields as in event 2) |
| `companionProfile` | object | Companion public info + nested `user` |
| `paymentSummary` | object | Same shape as in event 2 |

**Security — OTP:**

This event **never** includes `otp`. For client OTP, call:

`GET /api/booking/detail/:id`

**What to do in the app:**

- **Companion:** close popup if status is no longer `PENDING`; refresh lists.
- **Client:** show “Accepted”, “Declined”, or “Cancelled”.
- Any open detail screen: update UI from this payload or refetch detail API.

After this event, companion often also gets `booking:requests:count` with a new `pendingCount`.

---

### Event 4: `booking:request:expired`

**Direction:** Server → your app  

**Who should listen:** **Client and companion**.

**When does the server send it?**

- Booking was **PENDING** for **30 minutes** with no accept/decline. Server cancels it automatically (cron job every minute).

**Exact payload (JSON body):**

```json
{
  "bookingId": 123
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `bookingId` | number | Which booking expired |

**What to do in the app:**

- Close companion Accept/Deny popup if it was showing this id.
- Show “Request expired” on client waiting screen.
- Companion banner updates via following `booking:requests:count`.

---

### Event 5: `booking:subscribe` (app → server)

**Direction:** Your app → server  

**Who sends:** Client or companion, when they open **one booking detail** page.

**Exact payload you must send:**

```json
{
  "bookingId": 123
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `bookingId` | number | yes | Booking you are viewing |

**Code:**

```javascript
socket.emit('booking:subscribe', { bookingId: 123 });
```

Server checks you are the client or companion on that booking. If yes, you also receive updates in the `booking:{id}` room (helps for detail screen).

**You do not need this** just to show the popup from event 2 — `preview` is enough. Use subscribe when user stays on a detail route.

---

### Event 6: `booking:unsubscribe` (app → server)

**Direction:** Your app → server  

**When:** User leaves the booking detail screen.

**Exact payload:**

```json
{
  "bookingId": 123
}
```

**Code:**

```javascript
socket.emit('booking:unsubscribe', { bookingId: 123 });
```

---

## 6. Simple story (companion + client)

**Step A — Client books**

1. Client app: `POST /api/booking/book-companion/:companionProfileId`
2. Companion app (if socket connected): receives `booking:request:new` → **open popup**
3. Companion app: also receives `booking:requests:count` → **update banner**
4. Companion app (if in background): push notification with `bookingId`

**Step B — Companion accepts**

1. Companion app: `POST /api/booking/accept` with `{ "bookingId": 123, "action": "ACCEPT" }`
2. Both apps: receive `booking:request:updated` with `"status": "ACCEPTED"`
3. Companion: `booking:requests:count` goes down

**Step C — Companion declines**

1. Same API with `"action": "DECLINE"`
2. Status becomes `CANCELLED` in `booking:request:updated`

**Step D — Nobody answers for 30 minutes**

1. Both apps: `booking:request:expired` with `{ "bookingId": 123 }`

---

## 7. Copy-paste listener example

```javascript
socket.on('booking:requests:count', (body) => {
  // body.pendingCount
});

socket.on('booking:request:new', (body) => {
  // body.bookingId, body.pendingCount, body.preview
});

socket.on('booking:request:updated', (body) => {
  // body.status, body.bookingId, full booking fields
});

socket.on('booking:request:expired', (body) => {
  // body.bookingId
});
```

---

## 8. HTTP APIs you still must call (buttons)

### Client creates booking

```
POST /api/booking/book-companion/{companionProfileId}
Authorization: Bearer {clientToken}
```

Body example:

```json
{
  "date": "2026-07-23T00:00:00.000Z",
  "startTime": "2026-07-23T00:00:00.000Z",
  "endTime": "2026-07-23T02:00:00.000Z",
  "latitude": 0,
  "longitude": 0,
  "address": "Nwab Restaurant",
  "activity": "Fine Dining"
}
```

`companionProfileId` is the id from **CompanionProfile**, not the user id.

### Companion Accept button

```
POST /api/booking/accept
Authorization: Bearer {companionToken}
```

Body:

```json
{
  "bookingId": 123,
  "action": "ACCEPT"
}
```

### Companion Deny button

Same URL, body:

```json
{
  "bookingId": 123,
  "action": "DECLINE"
}
```

### Load full detail (OTP, extra fields)

```
GET /api/booking/detail/123
Authorization: Bearer {token}
```

---

## 9. Timer on popup (Acceptance 14:59 vs server)

Server expiry is **30 minutes** from when the booking was created (`createdAt`), while status is **PENDING**.

Use field **`requestExpiresAt`** from socket or detail API for the countdown.

If design shows 15 minutes, ask product/backend to align — today backend uses **30 minutes**.

---

## 10. What is NOT on sockets yet

Do not wait for socket events for:

- Pay with wallet
- Start session
- Verify OTP
- Complete booking
- Extension request/response
- Chat, feed, notification list

Use REST + pull to refresh for those screens.

---

## 11. Test without mobile app

In backend repo:

```bash
# Terminal 1 — companion listens
COMPANION_TOKEN="paste_jwt_here" npm run test:sockets -- listen

# Terminal 2 — client creates booking
CLIENT_TOKEN="paste_jwt_here" npm run test:sockets -- book --companion-id=1

# Terminal 2 — accept
COMPANION_TOKEN="paste_jwt_here" npm run test:sockets -- accept --booking-id=1 --action=ACCEPT
```

Get JWT from `POST /api/user/login` after OTP.

---

## 12. Checklist for frontend developer

- [ ] Connect socket after login with same JWT as APIs
- [ ] Companion: listen to `booking:requests:count` and `booking:request:new`
- [ ] Companion popup: data from `preview`; buttons call `POST /api/booking/accept`
- [ ] Client: listen to `booking:request:updated` and `booking:request:expired` on waiting screen
- [ ] Detail screen: emit `booking:subscribe` / `booking:unsubscribe`
- [ ] Do not expect OTP in any socket payload
- [ ] On reconnect: call dashboard or booking list API once, then keep using sockets

If something is unclear, ask backend — **only use the 6 event names listed in section 4**.
