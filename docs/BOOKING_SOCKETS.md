# Booking real-time updates (Socket.io) — easy guide

**Who should read this?**

1. **You (product / owner)** — read **Part A** only. It explains *what* happens in the app without heavy tech words.
2. **Your mobile developer** — read **Part A** once, then **Part B** while building. Part B has exact event names, JSON fields, and code.

---

# Part A — For you (plain English)

## What problem do sockets solve?

When something happens on the server (new booking, accept, extension, etc.), the **other person’s phone should update right away** — without the user pulling to refresh.

- **Normal API (HTTP)** = the app *asks* the server: “What’s new?”
- **Socket** = the server *tells* the app: “Something changed — here’s the data.”

**Important:** Buttons still use normal APIs (book, accept, cancel). Sockets only **notify** and **send data to show on screen**. They do not replace those APIs.

---

## Two roles in booking

| Role | Who | What they care about |
|------|-----|----------------------|
| **Client** | Person who books the companion | “Was I accepted?” “Can I extend the meeting?” |
| **Companion** | Person who gets booked | “How many new requests?” “Accept or deny popup” |

Both should connect to the socket **after login** (same login token as APIs). On logout, disconnect.

---

## Booking journey (simple timeline)

1. **Client sends a booking request** → Companion sees a **popup** and banner count goes up.
2. **Companion accepts or declines** → Client’s waiting screen updates.
3. **Nobody answers for 30 minutes** → Request **expires**; both sides see that.
4. **Meeting is accepted and paid** → Before start time, **client** gets reminders to **offer extension** (30 min and 15 min before start) via **push notification + socket**.
5. **Client asks to extend the meeting** (extra hours) → **Both** see an **extension bottom sheet**; companion accepts or denies.
6. **Meeting runs and ends** → Status can become **COMPLETED** (server cron); app can refresh from socket `booking:request:updated`.

---

## Extension — three different things (don’t mix them up)

| What | Who sees it | When |
|------|-------------|------|
| **Reminder to open extension UI** | **Client only** | **30 min** and **15 min before** meeting start (automatic; push + socket) |
| **Client actually requested extra hours** | **Client + companion** | After client taps and API `request-extension` succeeds |
| **Companion accepted or denied extension** | **Client + companion** | After companion taps Accept/Deny on extension |

Reminders do **not** create an extension by themselves. They only **ask the client** to open the extension screen. The client still chooses hours and calls the API.

---

## Push notifications vs sockets

| Channel | When it helps |
|---------|----------------|
| **Push (FCM)** | App in background or closed — user taps notification to open the right screen |
| **Socket** | App is open — update UI instantly (popup, banner, bottom sheet) |

For extension **reminders**, the server sends **both at the same time** (30 min and 15 min before start).

Push data includes things like `bookingId`, `action: SHOW_EXTENSION_SHEET`, and `promptType` (30 or 15 minutes).

---

## What is NOT real-time yet?

These still need **normal API calls** and/or manual refresh:

- Pay with wallet  
- Start session / verify OTP  
- Some steps after accept (check backend; use `GET /api/booking/detail/:id` when in doubt)

**OTP is never sent on sockets** — only on the detail API for the client.

---

# Part B — For your developer

## 1. Connect once after login

Use the **same base URL** as REST (e.g. `https://transfer.jikanzo.com` or `http://localhost:3000`).

| Setting | Value |
|---------|--------|
| Path | `/socket.io` |
| Library | `socket.io-client` v4 |
| Auth | Same JWT as `Authorization: Bearer ...` |

```javascript
import { io } from 'socket.io-client';

const socket = io('https://YOUR_API_HOST', {
  path: '/socket.io',
  auth: { token: userJwtToken },
  // If auth fails on your stack, try: query: { token: userJwtToken }
});

socket.on('connect', () => console.log('Socket connected'));
socket.on('connect_error', (err) => console.log('Socket failed', err.message));
```

**Common connect errors:** expired token, wrong token, or user logged in on another device (single active token).

**Who must connect?**

- **Companion:** on home / dashboard (new requests).
- **Client:** on booking wait screen, booking detail, and ideally whenever logged in if you want extension reminders live.

---

## 2. What the server does for you (no extra code)

On connect, the server joins your socket to:

| Room | You get it if… | Purpose |
|------|----------------|---------|
| `user:{userId}` | Always | Updates for this user as **client** |
| `companion:{companionProfileId}` | User has a companion profile | New requests + pending count |

You **do not** manually join these rooms.

Optional: on **booking detail screen**, emit `booking:subscribe` / `booking:unsubscribe` (see events 8–9) to also hear updates for that one booking id.

---

## 3. Cheat sheet — all event names

### Server → app (`socket.on(...)`)

| # | Event name | Main audience | One-line meaning |
|---|------------|---------------|------------------|
| 1 | `booking:requests:count` | Companion | Banner number: how many **PENDING** requests |
| 2 | `booking:request:new` | Companion | New request → open Accept/Deny popup |
| 3 | `booking:request:updated` | Client + companion | Status changed (accepted, cancelled, completed, etc.) |
| 4 | `booking:request:expired` | Client + companion | PENDING request timed out after 30 minutes |
| 5 | `booking:extension:requested` | Client + companion | Client asked for extra hours → extension sheet |
| 6 | `booking:extension:updated` | Client + companion | Companion accepted/denied extension |
| 7 | `booking:extension:prompt` | **Client only** | Reminder 30 / 15 min before start → open extension UI |

### App → server (`socket.emit(...)`)

| # | Event name | When |
|---|------------|------|
| 8 | `booking:subscribe` | User opened booking **detail** screen |
| 9 | `booking:unsubscribe` | User left that screen |

**Total: 9 booking-related socket names** (7 listen, 2 emit).

---

## 4. Each event — explained simply

For every event below:

- **Direction:** server → app or app → server  
- **Listen or emit:** what your code does  
- **When:** what happened on the server  
- **Payload:** JSON body (fields you read)  
- **App action:** what the UI should do  

---

### Event 1 — `booking:requests:count`

**Listen:** companion only  

**When:** companion connects; new booking; accept/decline/cancel/expire/reschedule changes pending count  

**Payload:**

```json
{ "pendingCount": 8 }
```

| Field | Meaning |
|-------|---------|
| `pendingCount` | Count of bookings with status **PENDING** for this companion |

**App action:** Update dashboard banner (e.g. “8 new requests”). You can still call dashboard API once on app open.

---

### Event 2 — `booking:request:new`

**Listen:** companion only  

**When:** client successfully calls `POST /api/booking/book-companion/:companionProfileId`  

**Payload (short):**

```json
{
  "bookingId": 123,
  "pendingCount": 8,
  "preview": { ... }
}
```

| Field | Meaning |
|-------|---------|
| `bookingId` | Use for accept API and detail API |
| `pendingCount` | Same as event 1 — update banner |
| `preview` | Full popup data (client name, time, place, money). Can be `null` — then call `GET /api/booking/detail/:id` |

**Important fields inside `preview`:**

| Field | Meaning |
|-------|---------|
| `status` | Usually `"PENDING"` |
| `startTime` / `endTime` | Session times (ISO strings) |
| `address` / `activity` | Where and what |
| `requestExpiresAt` | Auto-expire time (**30 min** after `createdAt` while PENDING) — use for countdown |
| `client` | `username`, `profileImage`, `age`, etc. |
| `paymentSummary` | Duration, rates, fees, earnings |

**App action:**

1. Open **Booking Request** modal.  
2. Fill UI from `preview`.  
3. Countdown from `requestExpiresAt`.  
4. Accept/Deny → **HTTP** `POST /api/booking/accept` (not socket).

**Background:** companion may also get FCM with `bookingId`; tap → same popup.

---

### Event 3 — `booking:request:updated`

**Listen:** client **and** companion  

**When (examples):**

| Action | API |
|--------|-----|
| Accept / decline | `POST /api/booking/accept` |
| Cancel | `POST /api/booking/cancel/:id` |
| Reschedule | `PATCH /api/booking/reschedule/:id` |
| Auto-complete when meeting end passed | Server cron (no API from app) |

**Payload:** Full booking snapshot — includes `bookingId`, `id`, `status`, times, `paymentStatus`, `extensionStatus`, `client`, `companionProfile`, `paymentSummary`, etc.

**Status values you will see:** `PENDING`, `ACCEPTED`, `ACTIVE`, `CANCELLED`, `COMPLETED`, …

**Security:** **No OTP** in this event. Client OTP: `GET /api/booking/detail/:id`.

**App action:**

- Companion: close popup if status ≠ `PENDING`; refresh lists.  
- Client: show accepted / declined / cancelled.  
- Detail screens: merge payload or refetch detail.  
- Companion often gets event 1 again with new `pendingCount`.

**Note:** Not every booking action emits this yet. If UI looks stale after pay/OTP/start, refetch detail API.

---

### Event 4 — `booking:request:expired`

**Listen:** client **and** companion  

**When:** booking stayed **PENDING** 30 minutes → server cancels it (cron every minute)  

**Payload:**

```json
{ "bookingId": 123 }
```

**App action:** Close companion popup for this id; show “Request expired” for client; banner updates via event 1.

---

### Event 5 — `booking:extension:requested`

**Listen:** client **and** companion  

**When:** client calls:

`POST /api/booking/request-extension/:bookingId`  
Body: `{ "extensionHours": 2 }` (example)

**Payload:** Extension “sheet” data plus:

```json
{
  "bookingId": 123,
  "extensionStatus": "PENDING",
  "extensionHours": 2,
  "extensionAmount": 80,
  "extensionPaymentStatus": "PENDING",
  "startTime": "...",
  "endTime": "...",
  "client": { ... },
  "companionProfile": { ... },
  "paymentSummary": { ... },
  "bottomSheet": {
    "companion": true,
    "client": true
  }
}
```

| Field | Meaning |
|-------|---------|
| `extensionStatus` | `"PENDING"` here |
| `extensionHours` | Hours client asked for |
| `extensionAmount` | Price for extension |
| `bottomSheet.companion` | Show Accept / Deny extension UI |
| `bottomSheet.client` | Show “waiting for companion” UI |

**App action:**

- **Companion:** open sheet; Accept/Deny → `POST /api/booking/respond-extension/:id` with `{ "action": "ACCEPT" }` or `"DENY"`.  
- **Client:** open waiting state (may already be open from API response).

---

### Event 6 — `booking:extension:updated`

**Listen:** client **and** companion  

**When:** companion calls `POST /api/booking/respond-extension/:id` with ACCEPT or DENY  

**Payload:** Same shape as event 5, but:

| After action | `extensionStatus` | `bottomSheet` |
|--------------|-------------------|-----------------|
| Accept | `"ACCEPTED"` | usually both `false` → **close sheet** |
| Deny | `"DENIED"` | both `false` → **close sheet** |
| Still pending (rare here) | `"PENDING"` | both `true` |

On **ACCEPT**, `endTime` may increase. You may also get `booking:request:updated` for lists.

---

### Event 7 — `booking:extension:prompt` (reminder — client only)

**Listen:** **client only** (companion does **not** receive this)

**When:** server **cron** (every minute):

- **30 minutes before** `startTime` — once per booking  
- **15 minutes before** `startTime` — once per booking  

Only for bookings that are:

- Status **ACCEPTED**  
- **Paid** (`paymentStatus` PAID)  
- Meeting **not started yet**  
- No extension already **PENDING**  

At the same time, server sends **FCM push** to the client.

**Socket payload:**

```json
{
  "bookingId": 123,
  "promptType": "30_MIN_BEFORE_START",
  "startTime": "...",
  "endTime": "...",
  "extensionStatus": "NONE",
  "client": { ... },
  "companionProfile": { ... },
  "paymentSummary": { ... },
  "bottomSheet": {
    "client": true,
    "companion": false
  }
}
```

| `promptType` | Meaning |
|--------------|---------|
| `30_MIN_BEFORE_START` | First reminder |
| `15_MIN_BEFORE_START` | Second reminder |

**Push notification (same moment):**

| Type | Title (example) |
|------|-----------------|
| `EXTENSION_PROMPT_30` | Meeting starts in 30 minutes |
| `EXTENSION_PROMPT_15` | Meeting starts in 15 minutes |

Push **data** (strings): `bookingId`, `promptType`, `action` = `SHOW_EXTENSION_SHEET`

**App action:**

1. If app open: `socket.on('booking:extension:prompt', ...)` → open **extension bottom sheet** for client (pick hours → call `request-extension` API).  
2. If user taps push: read `bookingId` + `SHOW_EXTENSION_SHEET` → navigate and open same sheet.  
3. This event does **not** mean extension was already requested — only **invite** the client to request.

```javascript
socket.on('booking:extension:prompt', (body) => {
  if (!body.bottomSheet?.client) return;
  openExtensionSheetForClient(body.bookingId, body);
});
```

---

### Event 8 — `booking:subscribe` (app → server)

**Emit when:** user opens **one booking detail** page  

```javascript
socket.emit('booking:subscribe', { bookingId: 123 });
```

Server checks you are the client or companion on that booking, then adds you to room `booking:123` for extra updates on that screen.

**You do not need this** for the companion popup from event 2 — `preview` is enough.

---

### Event 9 — `booking:unsubscribe` (app → server)

**Emit when:** user leaves booking detail  

```javascript
socket.emit('booking:unsubscribe', { bookingId: 123 });
```

---

## 5. Story — step by step (client + companion)

**A — Client books**

1. Client: `POST /api/booking/book-companion/:companionProfileId`  
2. Companion socket: `booking:request:new` → open popup  
3. Companion socket: `booking:requests:count` → update banner  
4. Background: FCM to companion with `bookingId`  

**B — Companion accepts**

1. Companion: `POST /api/booking/accept` `{ bookingId, action: "ACCEPT" }`  
2. Both: `booking:request:updated` with `status: "ACCEPTED"`  
3. Companion: `pendingCount` may drop (event 1)  

**C — Companion declines**

1. Same API with `action: "DECLINE"`  
2. Both: `booking:request:updated` (often `CANCELLED`)  

**D — 30 minutes, no answer**

1. Both: `booking:request:expired`  
2. Companion: new count via event 1  

**E — Automatic extension reminders (client)**

1. **30 min before start:** push + `booking:extension:prompt` (`30_MIN_BEFORE_START`)  
2. **15 min before start:** push + `booking:extension:prompt` (`15_MIN_BEFORE_START`)  
3. Client opens sheet and optionally calls `POST /api/booking/request-extension/:id`  

**F — Client requests extension**

1. Client: `POST /api/booking/request-extension/123` `{ "extensionHours": 2 }`  
2. Both: `booking:extension:requested`  
3. Companion: `POST /api/booking/respond-extension/123` `{ "action": "ACCEPT" }`  
4. Both: `booking:extension:updated` → close sheet or show new end time  

---

## 6. Copy-paste — all listeners

```javascript
// Companion — dashboard
socket.on('booking:requests:count', (body) => {
  setPendingCount(body.pendingCount);
});

socket.on('booking:request:new', (body) => {
  setPendingCount(body.pendingCount);
  if (body.preview) openRequestPopup(body.preview);
  else openRequestPopupAndLoadDetail(body.bookingId);
});

// Client + companion — booking state
socket.on('booking:request:updated', (body) => {
  updateBookingInState(body.bookingId, body);
  if (body.status !== 'PENDING') closeRequestPopupIfOpen(body.bookingId);
});

socket.on('booking:request:expired', (body) => {
  closeRequestPopupIfOpen(body.bookingId);
  showExpiredMessage(body.bookingId);
});

// Extension — after client calls request-extension API
socket.on('booking:extension:requested', (body) => {
  if (body.bottomSheet?.companion) openExtensionSheetCompanion(body);
  if (body.bottomSheet?.client) openExtensionSheetClientWaiting(body);
});

socket.on('booking:extension:updated', (body) => {
  if (!body.bottomSheet?.companion && !body.bottomSheet?.client) {
    closeExtensionSheet();
  } else {
    refreshExtensionSheet(body);
  }
});

// Extension — cron reminders (CLIENT ONLY)
socket.on('booking:extension:prompt', (body) => {
  if (body.bottomSheet?.client) {
    openExtensionSheetClientOffer(body); // user still picks hours + API
  }
});
```

---

## 7. HTTP APIs (buttons — not sockets)

### Client creates booking

```
POST /api/booking/book-companion/{companionProfileId}
Authorization: Bearer {clientToken}
```

`companionProfileId` = **CompanionProfile.id**, not User.id.

Example body:

```json
{
  "date": "2026-07-23T00:00:00.000Z",
  "startTime": "2026-07-23T18:00:00.000Z",
  "endTime": "2026-07-23T20:00:00.000Z",
  "latitude": 0,
  "longitude": 0,
  "address": "Nwab Restaurant",
  "activity": "Fine Dining"
}
```

### Companion accept / deny

```
POST /api/booking/accept
```

```json
{ "bookingId": 123, "action": "ACCEPT" }
```

```json
{ "bookingId": 123, "action": "DECLINE" }
```

### Client request extension

```
POST /api/booking/request-extension/{bookingId}
```

```json
{ "extensionHours": 2 }
```

### Companion respond to extension

```
POST /api/booking/respond-extension/{bookingId}
```

```json
{ "action": "ACCEPT" }
```

```json
{ "action": "DENY" }
```

### Full detail (OTP, extra fields)

```
GET /api/booking/detail/{bookingId}
```

---

## 8. Popup countdown timer

While status is **PENDING**, the request expires **30 minutes** after it was created.

Use **`requestExpiresAt`** from socket `preview` or detail API — not a hard-coded 15 minutes unless product changes the rule.

---

## 9. Auto-complete meetings

When an **ACTIVE** booking’s `endTime` is in the past, server cron sets status to **COMPLETED** and emits `booking:request:updated`.

There is **no** `POST /api/booking/complete` from the app.

---

## 10. Test from backend repo (optional)

```bash
# Terminal 1 — companion listens
COMPANION_TOKEN="paste_jwt" npm run test:sockets -- listen

# Terminal 2 — client books
CLIENT_TOKEN="paste_jwt" npm run test:sockets -- book --companion-id=1

# Terminal 2 — accept
COMPANION_TOKEN="paste_jwt" npm run test:sockets -- accept --booking-id=1 --action=ACCEPT
```

JWT from `POST /api/user/login` after OTP.

---

## 11. Developer checklist

- [ ] Connect socket after login (same JWT as APIs); disconnect on logout  
- [ ] **Companion:** listen `booking:requests:count`, `booking:request:new`  
- [ ] **Companion popup:** data from `preview`; buttons → `POST /api/booking/accept`  
- [ ] **Client:** listen `booking:request:updated`, `booking:request:expired` on wait screen  
- [ ] **Client:** listen `booking:extension:prompt` for 30 / 15 min reminders (+ handle FCM tap)  
- [ ] **Both:** listen `booking:extension:requested`, `booking:extension:updated`  
- [ ] Detail screen: `booking:subscribe` / `booking:unsubscribe`  
- [ ] Never expect OTP on any socket event  
- [ ] On reconnect: refresh booking list or dashboard once, then keep using sockets  

---

## 12. Glossary

| Word | Meaning |
|------|---------|
| **PENDING** | Companion has not accepted the booking yet |
| **ACCEPTED** | Companion said yes; client may pay / prepare for meeting |
| **ACTIVE** | Meeting in progress (after start flow on API) |
| **COMPLETED** | Meeting finished |
| **Extension** | Client wants more hours added to the same booking |
| **bottomSheet** | Flags telling which side should show the extension UI |
| **promptType** | Which automatic reminder fired (30 or 15 min before start) |
| **FCM** | Firebase push notification |

If anything does not match the app, compare with **section 3 event names** and ask backend — use only those exact names.

---

## 13. Predefined booking messages (realtime)

Full HTTP + rules: **`docs/BOOKING_MESSAGING.md`**.

| Event | When |
|-------|------|
| `booking:message:new` | After `POST /api/messaging/:id` — payload `{ bookingId, message }` |
| `booking:messaging:closed` | Coordination window ended — disable send UI |
| `booking:coordination:opened` | ~30 min before `startTime` — chat/calls enabled |
| `booking:coordination:closed` | Same as messaging closed |

Voice calling sockets: **`docs/BOOKING_CALLING.md`** (`booking:call:incoming`, `booking:call:state`, `booking:call:signal`).

Use `booking:subscribe` on the messages screen so both parties receive `booking:message:new`.

---

## 14. Live tracking (Uber-style, both sides)

Full rules: **`docs/BOOKING_LIVE_TRACKING_PLAN.md`**. Allowed when booking **`ACCEPTED`** (payment gate optional until payments go live); ends on **`POST /api/booking/start/:id`**, cancel, or session end.

**Subscribe:** `booking:subscribe` with `{ bookingId }` (same room as messages).

### Client → server

| Emit | Payload |
|------|---------|
| `booking:tracking:join` | `{ bookingId }` |
| `booking:tracking:update` | `{ bookingId, latitude, longitude, heading?, accuracy? }` |
| `booking:tracking:leave` | `{ bookingId }` |

### Server → client

| Event | Payload |
|-------|---------|
| `booking:tracking:state` | Full snapshot: meeting point, client + companion positions, `distanceBetweenKm`, ETA hints |
| `booking:tracking:location` | Single update after `tracking:update` |
| `booking:tracking:ended` | `{ bookingId, reason }` |
| `booking:tracking:error` | `{ bookingId, msg, code? }` |

### REST (optional)

| Method | Path |
|--------|------|
| GET | `/api/booking/:id/tracking` |
| POST | `/api/booking/:id/tracking/join` |
| POST | `/api/booking/:id/tracking/leave` |

**Flutter:** both apps call `join`, then emit `update` every ~5s; listen for `state` + `location`; use Google Directions for route/ETA on device.

---

## 15. Home / feed blue bar (booking reminder + OTP)

Shows on the main feed **from 30 minutes before `startTime`** until the booking ends (or is cancelled). Same payload on connect, every minute (cron), and when booking status changes.

### Server → client

| Event | Payload |
|-------|---------|
| `booking:home:bar` | See below |

**Visible example:**

```json
{
  "visible": true,
  "bookingId": 90,
  "status": "ACCEPTED",
  "phase": "PRE_START",
  "startTime": "2026-10-02T11:30:00.000Z",
  "endTime": "2026-10-02T13:30:00.000Z",
  "otp": "7856",
  "otpVerified": false,
  "minutesUntilStart": 12,
  "label": "Today's booking 4:30 PM · OTP 7856",
  "viewerRole": "client",
  "counterparty": { "id": 239, "username": "idrees" }
}
```

**Hidden:** `{ "visible": false }`

### REST (cold start)

| Method | Path |
|--------|------|
| GET | `/api/booking/home-bar` |

Tap bar → navigate to booking detail / live map using `bookingId`.
