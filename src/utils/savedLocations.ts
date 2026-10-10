import prisma from '../config/db';

export const MAX_SAVED_LOCATIONS = 20;

export type SavedLocation = {
  lat: number;
  lng: number;
  name?: string;
  isActive?: boolean;
  isPrimary?: boolean;
};

export function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  } 
  return null;
}

/** Normalize and validate saved locations from API input or DB JSON. */
export function normalizeSavedLocations(input: unknown): SavedLocation[] {
  if (!Array.isArray(input)) return [];
 
  const parsed: SavedLocation[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const lat = parseCoordinate(row.lat);
    const lng = parseCoordinate(row.lng);
    if (lat === null || lng === null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const name =
      typeof row.name === 'string' && row.name.trim() !== '' ? row.name.trim() : undefined;
    const isActive = row.isActive === true;
    const isPrimary = row.isPrimary === true;

    parsed.push({
      lat,
      lng,
      ...(name ? { name } : {}),
      ...(isActive ? { isActive: true } : {}),
      ...(isPrimary ? { isPrimary: true } : {}),
    });
  }

  if (parsed.length === 0) return [];

  let activeIdx = parsed.findIndex((l) => l.isActive);
  if (activeIdx === -1) activeIdx = parsed.findIndex((l) => l.isPrimary);
  if (activeIdx === -1) activeIdx = 0;

  const normalized = parsed.slice(0, MAX_SAVED_LOCATIONS).map((loc, index) => {
    const { isPrimary: _legacy, ...rest } = loc;
    return {
      ...rest,
      isActive: index === activeIdx,
    };
  });

  return normalized;
}

/** Location pin used in discover / feed (CompanionProfile.locationLat/Lng mirror). */
export function getActiveSavedLocation(
  locations: SavedLocation[],
): SavedLocation | null {
  if (locations.length === 0) return null;
  return locations.find((l) => l.isActive) ?? locations[0];
}

export function formatActiveLocationResponse(
  locations: SavedLocation[],
): { lat: number; lng: number; name?: string } | null {
  const active = getActiveSavedLocation(locations);
  if (!active) return null;
  return {
    lat: active.lat,
    lng: active.lng,
    ...(active.name ? { name: active.name } : {}),
  };
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Discover distance from the companion's currently active saved location. */
export function applyActiveLocationByIndex(existing: unknown, index: number): SavedLocation[] {
  const locs = normalizeSavedLocations(existing);
  if (index < 0 || index >= locs.length) {
    throw new Error('Invalid location index');
  }
  return locs.map((loc, i) => ({ ...loc, isActive: i === index }));
}

/** Update GPS pin for the currently active entry, or create the first saved location. */
export function applyActiveLocationCoordinates(
  existing: unknown,
  lat: number,
  lng: number,
  name?: string | null,
): SavedLocation[] {
  let locs = normalizeSavedLocations(existing);
  if (locs.length === 0) {
    return normalizeSavedLocations([
      { lat, lng, ...(name && String(name).trim() ? { name: String(name).trim() } : {}), isActive: true },
    ]);
  }

  const activeIdx = locs.findIndex((l) => l.isActive);
  const idx = activeIdx >= 0 ? activeIdx : 0;

  const updated = locs.map((loc, i) => {
    if (i !== idx) return { ...loc, isActive: false };
    const next: SavedLocation = { lat, lng, isActive: true };
    if (name !== undefined && name !== null && String(name).trim() !== '') {
      next.name = String(name).trim();
    } else if (loc.name) {
      next.name = loc.name;
    }
    return next;
  });

  return normalizeSavedLocations(updated);
}

export async function syncCompanionProfileActiveLocation(
  userId: number,
  locations: SavedLocation[],
): Promise<void> {
  const active = getActiveSavedLocation(normalizeSavedLocations(locations));
  await prisma.companionProfile.updateMany({
    where: { userId },
    data: active
      ? { locationLat: active.lat, locationLng: active.lng }
      : { locationLat: null, locationLng: null },
  });
}

export async function saveUserSavedLocations(
  userId: number,
  locations: SavedLocation[],
): Promise<{
  savedLocations: SavedLocation[];
  activeLocation: { lat: number; lng: number; name?: string } | null;
}> {
  const savedLocations = normalizeSavedLocations(locations);
  await prisma.user.update({
    where: { id: userId },
    data: { savedLocations },
  });
  await syncCompanionProfileActiveLocation(userId, savedLocations);
  return {
    savedLocations,
    activeLocation: formatActiveLocationResponse(savedLocations),
  };
}

export function discoveryLocationForCompanion(
  savedLocationsJson: unknown,
  locationLat: number | null | undefined,
  locationLng: number | null | undefined,
): SavedLocation | null {
  const saved = normalizeSavedLocations(savedLocationsJson);
  const active = getActiveSavedLocation(saved);
  if (active) return active;
  if (
    typeof locationLat === 'number' &&
    Number.isFinite(locationLat) &&
    typeof locationLng === 'number' &&
    Number.isFinite(locationLng)
  ) {
    return { lat: locationLat, lng: locationLng, isActive: true };
  }
  return null;
}
