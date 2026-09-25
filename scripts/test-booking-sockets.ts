/**
 * Manual Socket.io tester for booking events.
 *
 * Prerequisites:
 *   - Backend running (npm run dev)
 *   - Valid JWT for a user (login via POST /api/user/login)
 *
 * Usage:
 *
 *   # Terminal 1 — companion listens for events
 *   COMPANION_TOKEN="<jwt>" npm run test:sockets -- listen
 *
 *   # Terminal 2 — client creates a booking (companion profile id from DB/seed)
 *   CLIENT_TOKEN="<jwt>" npm run test:sockets -- book --companion-id=1
 *
 *   # Terminal 2 — companion accept/decline
 *   COMPANION_TOKEN="<jwt>" npm run test:sockets -- accept --booking-id=5 --action=ACCEPT
 *
 * Env:
 *   API_URL  default http://localhost:3000
 *
 * Optional listen flags:
 *   --subscribe=123   join booking room on connect
 */

import dotenv from 'dotenv';
import { io, Socket } from 'socket.io-client';
import { SOCKET_CLIENT_EVENTS, SOCKET_EVENTS } from '../src/sockets/constants';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      flags[key] = val ?? true;
    } else {
      positional.push(arg);
    }
  }
  return { command: positional[0], flags };
}

function logEvent(name: string, payload: unknown) {
  const ts = new Date().toISOString();
  console.log(`\n[${ts}] << ${name}`);
  console.log(JSON.stringify(payload, null, 2));
}

function connectSocket(token: string): Socket {
  const socket = io(API_URL, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('connect', () => {
    console.log(`Connected  socketId=${socket.id}  url=${API_URL}`);
  });

  socket.on('connect_error', (err) => {
    console.error('Connect error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
  });

  for (const event of Object.values(SOCKET_EVENTS)) {
    socket.on(event, (payload) => logEvent(event, payload));
  }

  return socket;
}

async function api(
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>
) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json as Record<string, unknown>;
}

function bookingPayload() {
  const start = new Date();
  start.setHours(start.getHours() + 2);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const date = new Date(start);
  date.setHours(0, 0, 0, 0);

  return {
    date: date.toISOString(),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    latitude: 0,
    longitude: 0,
    address: 'Socket test venue',
    activity: 'Coffee',
  };
}

async function cmdListen(flags: Record<string, string | boolean>) {
  const token =
    (process.env.COMPANION_TOKEN as string) ||
    (process.env.SOCKET_TEST_TOKEN as string) ||
    (flags.token as string);

  if (!token) {
    console.error(
      'Missing token. Set COMPANION_TOKEN or SOCKET_TEST_TOKEN, or pass --token=<jwt>'
    );
    process.exit(1);
  }

  const socket = connectSocket(token);

  socket.on('connect', () => {
    const subscribeId = flags.subscribe as string | undefined;
    if (subscribeId) {
      const bookingId = Number(subscribeId);
      console.log(`Emitting ${SOCKET_CLIENT_EVENTS.BOOKING_SUBSCRIBE}`, { bookingId });
      socket.emit(SOCKET_CLIENT_EVENTS.BOOKING_SUBSCRIBE, { bookingId });
    }
  });

  console.log('Listening for booking socket events. Ctrl+C to exit.');
  console.log('Events:', Object.values(SOCKET_EVENTS).join(', '));
}

async function cmdBook(flags: Record<string, string | boolean>) {
  const token = (process.env.CLIENT_TOKEN as string) || (flags.token as string);
  const companionId = Number(flags['companion-id'] ?? process.env.COMPANION_PROFILE_ID);

  if (!token || !Number.isFinite(companionId)) {
    console.error(
      'Need CLIENT_TOKEN (or --token) and --companion-id=<companionProfileId> (or COMPANION_PROFILE_ID)'
    );
    process.exit(1);
  }

  const result = await api(
    'POST',
    `/api/booking/book-companion/${companionId}`,
    token,
    bookingPayload()
  );
  console.log('Booking created via REST:');
  console.log(JSON.stringify(result, null, 2));
}

async function cmdAccept(flags: Record<string, string | boolean>) {
  const token = (process.env.COMPANION_TOKEN as string) || (flags.token as string);
  const bookingId = Number(flags['booking-id']);
  const action = (flags.action as string) || 'ACCEPT';

  if (!token || !Number.isFinite(bookingId)) {
    console.error('Need COMPANION_TOKEN (or --token) and --booking-id=<id>');
    process.exit(1);
  }

  if (action !== 'ACCEPT' && action !== 'DECLINE') {
    console.error('action must be ACCEPT or DECLINE');
    process.exit(1);
  }

  const result = await api('POST', '/api/booking/accept', token, {
    bookingId,
    action,
  });
  console.log('Accept/decline via REST:');
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case 'listen':
      await cmdListen(flags);
      break;
    case 'book':
      await cmdBook(flags);
      break;
    case 'accept':
      await cmdAccept(flags);
      break;
    default:
      console.log(`
Booking socket tester

  npm run test:sockets -- listen [--token=JWT] [--subscribe=bookingId]
  npm run test:sockets -- book --companion-id=1 [--token=CLIENT_JWT]
  npm run test:sockets -- accept --booking-id=1 [--action=ACCEPT|DECLINE] [--token=JWT]

API_URL=${API_URL}
`);
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
