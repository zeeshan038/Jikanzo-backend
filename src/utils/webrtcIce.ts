import crypto from 'crypto';

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/**
 * Coturn REST-style short-lived credentials (TURN REST API).
 * Set TURN_SECRET + TURN_URLS (comma-separated) in env.
 */
export function buildTurnCredentials(
  scopeId: string,
  ttlSeconds = 86_400
): { username: string; credential: string } | null {
  const secret = process.env.TURN_SECRET?.trim();
  if (!secret) return null;

  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:${scopeId}`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return { username, credential };
}

function parseEnvList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildIceServersForUser(userId: number): IceServerConfig[] {
  const servers: IceServerConfig[] = [];

  for (const url of parseEnvList(process.env.STUN_URLS)) {
    servers.push({ urls: url });
  }

  const turnUrls = parseEnvList(process.env.TURN_URLS);
  const turnCreds = buildTurnCredentials(String(userId));
  if (turnUrls.length > 0 && turnCreds) {
    servers.push({
      urls: turnUrls.length === 1 ? turnUrls[0]! : turnUrls,
      username: turnCreds.username,
      credential: turnCreds.credential,
    });
  }

  if (servers.length === 0) {
    servers.push({ urls: 'stun:stun.l.google.com:19302' });
  }

  return servers;
}
