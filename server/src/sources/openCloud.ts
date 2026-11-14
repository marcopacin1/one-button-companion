import { type DataStoreReader, type OrderedEntry, UpstreamError } from "./types.js";

const BASE = "https://apis.roblox.com/cloud/v2";
const MAX_PAGE = 100; // Open Cloud's page-size ceiling for ordered entries

type Fetch = typeof fetch;

/**
 * Open Cloud v2 client. Needs a key with read access to universe-datastores and
 * ordered-data-stores; nothing in here ever writes.
 */
export class OpenCloudReader implements DataStoreReader {
  constructor(
    private readonly apiKey: string,
    private readonly universeId: string,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async listOrdered(store: string, limit: number): Promise<OrderedEntry[]> {
    const out: OrderedEntry[] = [];
    let pageToken: string | undefined;
    // Paginate only as far as asked for; a leaderboard read is normally one page.
    while (out.length < limit) {
      const url = new URL(
        `${BASE}/universes/${this.universeId}/ordered-data-stores/${encodeURIComponent(store)}/scopes/global/entries`,
      );
      url.searchParams.set("orderBy", "value desc");
      url.searchParams.set("maxPageSize", String(Math.min(MAX_PAGE, limit - out.length)));
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await this.request(url);
      // A store nobody has written to yet (e.g. a brand-new week) is an empty board.
      if (res.status === 404) return out;
      const body = (await res.json()) as {
        orderedDataStoreEntries?: { id: string; value: number | string }[];
        nextPageToken?: string;
      };
      for (const e of body.orderedDataStoreEntries ?? []) {
        out.push({ id: e.id, value: Number(e.value) });
      }
      pageToken = body.nextPageToken || undefined;
      if (!pageToken) break;
    }
    return out.slice(0, limit);
  }

  async getEntry(store: string, key: string): Promise<unknown | null> {
    const url = new URL(
      `${BASE}/universes/${this.universeId}/data-stores/${encodeURIComponent(store)}/entries/${encodeURIComponent(key)}`,
    );
    const res = await this.request(url);
    if (res.status === 404) return null;
    const body = (await res.json()) as { value?: unknown };
    return body.value ?? null;
  }

  private async request(url: URL): Promise<Response> {
    const res = await this.fetchImpl(url, {
      headers: { "x-api-key": this.apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok || res.status === 404) return res;
    // Never echo the key; the body is Roblox's error message, which is safe to log.
    const detail = await res.text().catch(() => "");
    const hint =
      res.status === 401 || res.status === 403
        ? " (check the API key's permissions and experience scope)"
        : res.status === 429
          ? " (Open Cloud rate limit)"
          : "";
    throw new UpstreamError(
      `Open Cloud ${res.status} for ${url.pathname}${hint}: ${detail.slice(0, 200)}`,
      res.status,
    );
  }
}
