/**
 * Phase 13.1 – Vigilance Banner Helpers (Pure, Deterministic)
 *
 * All functions accept nowMs instead of calling Date.now(), enabling
 * fully deterministic testing from eval scripts.
 */

export interface AckEntry {
  acknowledgedUntil: string;
}

export type AckMap = Record<string, AckEntry>;

const ACK_STORAGE_PREFIX = "AA_VIGILANCE_ACK_v1:";

export function ackStorageKey(profileId: string): string {
  return `${ACK_STORAGE_PREFIX}${profileId}`;
}

/**
 * Should the banner be visible for this trigger?
 * Returns false if trigger is null or the checkId has a valid (non-expired) ack.
 */
export function shouldShowBanner(
  trigger: { checkId: string } | null,
  nowMs: number,
  ackMap: AckMap
): boolean {
  if (!trigger) return false;
  const ack = ackMap[trigger.checkId];
  if (!ack) return true;
  return nowMs >= new Date(ack.acknowledgedUntil).getTime();
}

/**
 * Compute remaining time until vigilance window expires.
 * Returns null if already expired.
 */
export function computeExpiresIn(
  triggerLastSeenAt: string,
  nowMs: number,
  windowHours: number
): { hours: number; minutes: number } | null {
  const expiryMs =
    new Date(triggerLastSeenAt).getTime() + windowHours * 60 * 60 * 1000;
  const remainingMs = expiryMs - nowMs;
  if (remainingMs <= 0) return null;
  const totalMinutes = Math.floor(remainingMs / 60_000);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/**
 * Compute the ISO timestamp for acknowledgement expiry.
 * TTL = min(windowHours, 12).
 */
export function nextAckUntil(nowMs: number, windowHours: number): string {
  const defaultAckHours = Math.min(windowHours, 12);
  return new Date(nowMs + defaultAckHours * 60 * 60 * 1000).toISOString();
}

/** Read ack map from localStorage. Returns empty map on any error. */
export function readAckMap(profileId: string): AckMap {
  try {
    const raw = localStorage.getItem(ackStorageKey(profileId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as AckMap;
  } catch {
    return {};
  }
}

/** Write a single checkId acknowledgement into the ack map. */
export function writeAck(
  profileId: string,
  checkId: string,
  acknowledgedUntil: string
): void {
  const map = readAckMap(profileId);
  map[checkId] = { acknowledgedUntil };
  pruneExpiredEntries(map, Date.now());
  localStorage.setItem(ackStorageKey(profileId), JSON.stringify(map));
}

/** Remove expired entries to prevent unbounded localStorage growth. */
function pruneExpiredEntries(map: AckMap, nowMs: number): void {
  for (const key of Object.keys(map)) {
    if (nowMs >= new Date(map[key].acknowledgedUntil).getTime()) {
      delete map[key];
    }
  }
}
