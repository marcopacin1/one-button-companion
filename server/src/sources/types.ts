/** Read-only access to the game's DataStores. Implemented by Open Cloud and by the mock. */
export interface DataStoreReader {
  /** Top entries of an OrderedDataStore, highest value first. Empty if the store has none. */
  listOrdered(store: string, limit: number): Promise<OrderedEntry[]>;
  /** One standard DataStore entry, or null when the key does not exist. */
  getEntry(store: string, key: string): Promise<unknown | null>;
}

export interface OrderedEntry {
  /** The entry key. LeaderboardService writes tostring(player.UserId). */
  id: string;
  value: number;
}

export interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
}

/** Public Roblox user and avatar lookups (no API key needed). */
export interface UserDirectory {
  getUsers(ids: number[]): Promise<Map<number, RobloxUser>>;
  findByUsername(username: string): Promise<RobloxUser | null>;
  getHeadshots(ids: number[]): Promise<Map<number, string>>;
}

/** Thrown when Roblox answers with an error. Mapped to HTTP 502 by the API. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}
