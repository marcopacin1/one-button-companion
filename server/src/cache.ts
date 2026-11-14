/**
 * A small TTL cache with two properties that matter for an API sitting in front of
 * rate-limited upstreams:
 *
 * - Concurrent requests for the same key share ONE in-flight load, so a burst of
 *   visitors costs Roblox one call, not one per visitor.
 * - If a refresh fails and an older value exists, the older value is served (and
 *   marked stale) instead of an error. Same idea as the lounge boards keeping the
 *   last good board on the wall when a refresh fails.
 */
export interface Cached<T> {
  value: T;
  fetchedAt: number;
  stale: boolean;
}

interface Slot<T> {
  value?: T;
  fetchedAt: number;
  expiresAt: number;
  inflight?: Promise<Cached<T>>;
}

export class TtlCache {
  private readonly slots = new Map<string, Slot<unknown>>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 2_000,
  ) {}

  async get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<Cached<T>> {
    const slot = this.slots.get(key) as Slot<T> | undefined;
    const t = this.now();

    if (slot && "value" in slot && slot.expiresAt > t) {
      return { value: slot.value as T, fetchedAt: slot.fetchedAt, stale: false };
    }
    if (slot?.inflight) return slot.inflight;

    const entry: Slot<T> = slot ?? { fetchedAt: 0, expiresAt: 0 };
    const inflight = (async (): Promise<Cached<T>> => {
      try {
        const value = await load();
        entry.value = value;
        entry.fetchedAt = this.now();
        entry.expiresAt = entry.fetchedAt + ttlMs;
        return { value, fetchedAt: entry.fetchedAt, stale: false };
      } catch (err) {
        if ("value" in entry) {
          // Retry sooner than a full TTL, but not on every request.
          entry.expiresAt = this.now() + Math.min(ttlMs, 15_000);
          return { value: entry.value as T, fetchedAt: entry.fetchedAt, stale: true };
        }
        this.slots.delete(key);
        throw err;
      } finally {
        delete entry.inflight;
      }
    })();

    entry.inflight = inflight;
    this.slots.set(key, entry as Slot<unknown>);
    this.evictIfNeeded();
    return inflight;
  }

  private evictIfNeeded() {
    if (this.slots.size <= this.maxEntries) return;
    // Maps iterate in insertion order: drop the oldest keys first.
    const excess = this.slots.size - this.maxEntries;
    let i = 0;
    for (const key of this.slots.keys()) {
      if (i++ >= excess) break;
      this.slots.delete(key);
    }
  }
}
