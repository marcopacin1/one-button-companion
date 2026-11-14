import { type RobloxUser, type UserDirectory, UpstreamError } from "./types.js";

type Fetch = typeof fetch;
const BATCH = 100;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Roblox's public users and thumbnails APIs. */
export class RobloxUserDirectory implements UserDirectory {
  constructor(private readonly fetchImpl: Fetch = fetch) {}

  async getUsers(ids: number[]): Promise<Map<number, RobloxUser>> {
    const result = new Map<number, RobloxUser>();
    const wanted = [...new Set(ids.filter((id) => id > 0))];
    for (const batch of chunks(wanted, BATCH)) {
      const body = await this.json<{ data: RobloxUser[] }>("https://users.roblox.com/v1/users", {
        method: "POST",
        body: JSON.stringify({ userIds: batch, excludeBannedUsers: false }),
      });
      for (const u of body.data ?? []) result.set(u.id, { id: u.id, name: u.name, displayName: u.displayName });
    }
    return result;
  }

  async findByUsername(username: string): Promise<RobloxUser | null> {
    const body = await this.json<{ data: RobloxUser[] }>("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    });
    const u = body.data?.[0];
    return u ? { id: u.id, name: u.name, displayName: u.displayName } : null;
  }

  async getHeadshots(ids: number[]): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    const wanted = [...new Set(ids.filter((id) => id > 0))];
    for (const batch of chunks(wanted, BATCH)) {
      const url = new URL("https://thumbnails.roblox.com/v1/users/avatar-headshot");
      url.searchParams.set("userIds", batch.join(","));
      url.searchParams.set("size", "150x150");
      url.searchParams.set("format", "Png");
      url.searchParams.set("isCircular", "false");
      const body = await this.json<{ data: { targetId: number; state: string; imageUrl: string | null }[] }>(
        url.toString(),
      );
      for (const t of body.data ?? []) {
        if (t.state === "Completed" && t.imageUrl) result.set(t.targetId, t.imageUrl);
      }
    }
    return result;
  }

  private async json<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await this.fetchImpl(url, {
      ...init,
      headers: { "content-type": "application/json", accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new UpstreamError(`Roblox users API ${res.status} for ${new URL(url).pathname}`, res.status);
    return (await res.json()) as T;
  }
}
