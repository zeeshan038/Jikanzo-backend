# Booking voice calling (WebRTC V1)

1-to-1 **audio** between client and companion on a booking. Media is **WebRTC** (Flutter); the backend handles **auth**, **coordination window**, **call state**, **signaling relay**, and **ICE/TURN config** — not audio bytes.

## Coordination window (same as chat)

Chat and calls share one rule (`src/utils/bookingCoordination.ts`):

- **Open:** booking `status` is `ACCEPTED` or `ACTIVE`, and `now` is in `[startTime − 30 minutes, endTime)`.
- **Closed:** before that window, after `endTime`, or when `CANCELLED` / `COMPLETED`.

Sockets: `booking:coordination:opened` / `booking:coordination:closed` (and legacy `booking:messaging:closed` with the same payload).

## HTTP (Bearer auth)

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/api/calling/:id/status` | `{ available, reason, opensAt, closesAt, activeCall? }` |
| GET | `/api/calling/:id/config` | `{ iceServers, activeCall? }` |
| GET | `/api/calling/:id/history` | Recent `BookingCall` rows |
| POST | `/api/calling/:id/calls` | Start call → `RINGING` |
| POST | `/api/calling/:id/calls/:callId/accept` | → `ACCEPTED` |
| POST | `/api/calling/:id/calls/:callId/reject` | → `REJECTED` |
| POST | `/api/calling/:id/calls/:callId/end` | → `ENDED` / `MISSED` / `REJECTED` |

## Call states

`RINGING` → `ACCEPTED` → `ENDED` · also `REJECTED`, `MISSED` (45s ring timeout), `FAILED`.

Terminal calls append a **chat system line** (`kind: CALL`) and emit `booking:message:new`.

## Realtime (Socket.io)

Subscribe: `booking:subscribe` with `{ bookingId }`.

| Event | Direction | Purpose |
|-------|-----------|---------|
| `booking:call:incoming` | Server → receiver | `{ bookingId, call }` |
| `booking:call:state` | Server → both | `{ bookingId, call }` |
| `booking:call:signal` | Server → peer | WebRTC `{ callId, fromUserId, signalType, sdp?, candidate? }` |
| `booking:call:signal` | Client → server | Same shape; relayed to the other participant |

Client `signalType`: `offer` | `answer` | `ice`.

## Push (FCM)

Incoming ring when callee is not in the booking socket room: `type=BOOKING_CALL`, `bookingId`, `callId`.

## Environment (TURN)

Optional but recommended for mobile:

- `STUN_URLS` — comma-separated STUN URIs
- `TURN_URLS` — comma-separated TURN URIs
- `TURN_SECRET` — coturn REST shared secret for short-lived credentials

If unset, clients receive public Google STUN only (P2P may fail on strict NAT).

## Mobile flow

1. `GET /api/calling/:id/status` + `GET /api/messaging/:id/status` (same window).
2. `booking:subscribe` on chat/call screens.
3. Tap call → `POST /api/calling/:id/calls` → show outgoing UI.
4. Callee: accept via REST → exchange SDP/ICE via `booking:call:signal` → WebRTC audio.
5. Hang up → `POST .../end` → disable tracks locally.
