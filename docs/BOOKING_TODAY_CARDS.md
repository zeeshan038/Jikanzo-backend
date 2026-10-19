# Companion “Today booking” cards

Companion home carousel for **today’s confirmed sessions**. Top-right of each card cycles through:

**Starts in** → **Enter OTP** → **Ends in** (+ **Extend Booking** while the session is `ACTIVE`).

Realtime updates use Socket.io. Cold start uses the companion dashboard REST API. Both return the **same card shape**.

Related: socket overview in [`BOOKING_SOCKETS.md`](./BOOKING_SOCKETS.md) §16.

---

## Who sees this?

| Role | Sees today cards? |
|------|-------------------|
| **Companion** | Yes — home / dashboard |
| **Client** | No (client uses home bar / booking detail instead) |

Only bookings with status **`ACCEPTED`**, **`ACTIVE`**, or **`COMPLETED`** whose **`startTime`** falls on the **current calendar day** (server local midnight window) appear. **`PENDING`** requests stay under “new requests”, not today cards.

---

## Card phases (`cardPhase`)

| `cardPhase` | When | UI |
|-------------|------|-----|
| `STARTS_IN` | Before `startTime` | Green “Starts in” countdown → `countdownTarget` (= `startTime`) |
| `ENTER_OTP` | `startTime` reached and `otpVerified === false` | Dark “Enter OTP” button |
| `ENDS_IN` | OTP verified **or** status `ACTIVE` | Red “Ends in” countdown → `countdownTarget` (= `endTime`) |
| `COMPLETED` | Status `COMPLETED` | Done — no timer |

| Extra field | Meaning |
|-------------|---------|
| `countdownTarget` | ISO timestamp to count down to; `null` for `ENTER_OTP` / `COMPLETED` |
| `canExtend` | `true` only when `status === "ACTIVE"` — show “Extend Booking” |
| `otpVerified` | Whether booking OTP was verified |

**OTP code is never included** in today-card payloads (socket or dashboard). The **client** gets the code from detail / home-bar APIs; the **companion** types it via verify-otp.

---

## Realtime (Socket.io)

### Event

| Event | Direction | Audience |
|-------|-----------|----------|
| `booking:today:cards` | Server → client | Companion only |

### When it fires

- Companion socket **connect**
- Booking **accept / cancel / reschedule**
- **Verify OTP** / **start session**
- **Extension** request / accept / deny
- Booking **auto-complete** (cron after `endTime`)
- **Every minute** (cron) so `STARTS_IN` flips to `ENTER_OTP` without pull-to-refresh

### Payload

```json
{
  "bookings": [
    {
      "id": 15334,
      "status": "ACCEPTED",
      "date": "2026-07-23T00:00:00.000Z",
      "startTime": "2026-07-23T18:00:00.000Z",
      "endTime": "2026-07-23T20:00:00.000Z",
      "address": null,
      "activity": null,
      "otpVerified": false,
      "extensionStatus": "NONE",
      "clientId": 228,
      "companionId": 12,
      "cardPhase": "STARTS_IN",
      "countdownTarget": "2026-07-23T18:00:00.000Z",
      "canExtend": false,
      "client": {
        "id": 228,
        "username": "Kenji Sato",
        "profileImage": "https://example.com/pic.jpg"
      }
    }
  ]
}
```

Replace the entire today-card list with `bookings` on each event (empty array = no sessions today).

### Connect example

```javascript
socket.on('booking:today:cards', (payload) => {
  // payload.bookings — same shape as GET /api/companion/dashboard → data.todayBookings
  setTodayBookings(payload.bookings);
});
```

No client emit is required. Companions are already in `user:{userId}` on connect.

---

## REST (cold start)

| Method | Path | Field |
|--------|------|--------|
| GET | `/api/companion/dashboard` | `data.todayBookings` |

Same fields as the socket list (`cardPhase`, `countdownTarget`, `canExtend`, …). Use for first paint before / if the socket is offline; then prefer live `booking:today:cards`.

---

## Actions still use REST

Sockets only **notify**. Buttons call HTTP:

| UI | API |
|----|-----|
| Enter OTP | `POST /api/booking/verify-otp/:id` body `{ "otp": "1234" }` |
| Start session (after OTP) | `POST /api/booking/start/:id` (if your app uses start separately) |
| Extend Booking | Existing extension endpoints (see `BOOKING_SOCKETS.md`) |

After a successful OTP / start / extend, expect a fresh `booking:today:cards` (and the minute cron will also refresh phases).

---

## Flutter checklist

1. After login, connect Socket.io with the same JWT as REST.
2. Listen for `booking:today:cards` on companion home; replace the carousel data.
3. Render top-right from `cardPhase` + tick locally against `countdownTarget`.
4. Optional: when local “Starts in” hits zero, show `ENTER_OTP` immediately; server will confirm on the next cron/emit.
5. Cold start / offline: `GET /api/companion/dashboard` → `todayBookings`.
6. Never expect an OTP code on this event.

---

## Implementation map

| Piece | Location |
|-------|----------|
| Phase helpers + payload | `src/utils/todayBookingCard.ts` |
| Socket event name | `SOCKET_EVENTS.TODAY_CARDS` → `booking:today:cards` in `src/sockets/constants.ts` |
| Emit / refresh | `emitTodayCardsToUser`, `refreshTodayCardsForBooking`, `refreshBookingRealtimeSurfaces` in `src/sockets/bookingEmit.ts` |
| On companion connect | `emitInitialTodayCards` in `src/sockets/index.ts` |
| Minute cron | `src/cron/todayCards.ts` (from `src/cron/booking.ts`) |
| Dashboard | `src/controllers/companion/dashboard.ts` |
