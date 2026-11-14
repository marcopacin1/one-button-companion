import { TtlCache } from "./cache.js";
import {
  EVENT_BALANCE_KEY,
  EVENT_BALANCE_STORE,
  EVENT_CATALOG_KEY,
  EVENT_CATALOG_STORE,
  PLAYER_STORE,
  STATS,
  type Scope,
  type StatId,
  TITLE_STATS_KEY,
  TITLE_STATS_STORE,
  playerKey,
  storeNameFor,
} from "./game/constants.js";
import {
  type EventStatRecord,
  type MasteryTierId,
  levelInfo,
  masteryProgress,
  masteryTier,
  prettifyEventId,
  unpackRatio,
  weekIndex,
  weekResetAt,
} from "./game/formulas.js";
import { TITLES } from "./game/titles.js";
import type { DataStoreReader, RobloxUser, UserDirectory } from "./sources/types.js";

const TTL = {
  board: 60_000, // matches LeaderboardService's own GLOBAL_CACHE_TTL
  profile: 60_000,
  aggregate: 5 * 60_000, // the game flushes these once a minute at most
  catalog: 30 * 60_000,
  users: 6 * 60 * 60_000, // usernames and avatars rarely change
};

/** Ranks read per board. LeaderboardService reads 100 too, so ranks agree with the lounge. */
const BOARD_DEPTH = 100;

/** Below this many participants an event's survival rate is flagged as low-sample. */
export const EVENT_MIN_SAMPLE = 20;

// ── Response shapes ───────────────────────────────────────────────────────────

export interface PlayerRef {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BoardRow extends PlayerRef {
  rank: number;
  value: number;
  /** Ratio boards only: events faced behind the percentage. */
  sample?: number;
}

export interface Board {
  stat: StatId;
  label: string;
  scope: Scope;
  rows: BoardRow[];
  /** Weekly boards only: when this week's boards reset (ISO, Monday 00:00 UTC). */
  resetsAt?: string;
  updatedAt: string;
  stale: boolean;
}

export interface PlayerProfile extends PlayerRef {
  level: number;
  expIntoLevel: number;
  expToNext: number;
  totalExp: number;
  stats: {
    presses: number;
    eventsSurvived: number;
    bestStreak: number;
    deaths: number;
    lifetimeCoins: number;
    fishCaught: number;
    ratio: { percent: number; survived: number; faced: number } | null;
  };
  thisWeek: { presses: number; bestStreak: number; survived: number; faced: number } | null;
  /** Rank on each all-time board, or null when outside the top 100. */
  ranks: Record<StatId, number | null>;
  titles: { id: string; reason: string | null; rarityPercent: number | null }[];
  mastery: {
    discovered: number;
    bronze: number;
    silver: number;
    gold: number;
    events: { id: string; name: string; encounters: number; progress: number; tier: MasteryTierId | null }[];
  };
  updatedAt: string;
  stale: boolean;
}

export interface EventStat {
  id: string;
  name: string;
  category: string | null;
  starts: number;
  participants: number;
  survived: number;
  failed: number;
  survivalRate: number | null;
  avgSecondsToDeath: number | null;
  lowSample: boolean;
}

export interface TitleStat {
  id: string;
  reason: string | null;
  source: string | null;
  holders: number;
  percent: number;
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const iso = (ms: number) => new Date(ms).toISOString();

export class CompanionService {
  private readonly cache: TtlCache;

  constructor(
    private readonly store: DataStoreReader,
    private readonly users: UserDirectory,
    private readonly now: () => number = Date.now,
  ) {
    this.cache = new TtlCache(now);
  }

  // ── Leaderboards ───────────────────────────────────────────────────────────

  async getBoard(stat: StatId, scope: Scope, limit = 25): Promise<Board> {
    const nowSec = Math.floor(this.now() / 1000);
    const week = weekIndex(nowSec);
    const def = STATS.find((s) => s.id === stat)!;
    const storeName = storeNameFor(stat, scope, week);

    const raw = await this.cache.get(`board:${storeName}`, TTL.board, () =>
      this.store.listOrdered(storeName, BOARD_DEPTH),
    );

    const minSample =
      "minSample" in def ? (scope === "weekly" ? def.minSampleWeekly : def.minSample) : 0;

    const ranked = raw.value
      .map((e) => ({ userId: Number(e.id), value: e.value }))
      // Studio multiplayer-test players have UserIds <= 0 and can never resolve to a
      // real account. The game now refuses to write them; filter any old rows anyway.
      .filter((e) => Number.isInteger(e.userId) && e.userId > 0)
      .map((e) => {
        if (stat !== "ratio") return { ...e, sample: undefined as number | undefined };
        const r = unpackRatio(e.value);
        return { userId: e.userId, value: r.percent, sample: r.sample };
      })
      .filter((e) => e.sample === undefined || e.sample >= minSample)
      .slice(0, limit);

    const refs = await this.playerRefs(ranked.map((e) => e.userId));
    return {
      stat,
      label: def.label,
      scope,
      rows: ranked.map((e, i) => ({
        ...refs.get(e.userId)!,
        rank: i + 1,
        value: e.value,
        ...(e.sample !== undefined ? { sample: e.sample } : {}),
      })),
      ...(scope === "weekly" ? { resetsAt: iso(weekResetAt(nowSec) * 1000) } : {}),
      updatedAt: iso(raw.fetchedAt),
      stale: raw.stale,
    };
  }

  async getBoards(scope: Scope, limit = 10): Promise<Board[]> {
    return Promise.all(STATS.map((s) => this.getBoard(s.id, scope, limit)));
  }

  // ── Players ────────────────────────────────────────────────────────────────

  async findPlayer(username: string): Promise<PlayerRef> {
    const key = username.trim().toLowerCase();
    const found = await this.cache.get(`lookup:${key}`, TTL.users, () => this.users.findByUsername(key));
    if (!found.value) throw new NotFoundError(`No Roblox user named "${username}"`);
    const refs = await this.playerRefs([found.value.id], new Map([[found.value.id, found.value]]));
    return refs.get(found.value.id)!;
  }

  async getPlayer(userId: number): Promise<PlayerProfile> {
    const raw = await this.cache.get(`profile:${userId}`, TTL.profile, () =>
      this.store.getEntry(PLAYER_STORE, playerKey(userId)),
    );
    if (!raw.value) throw new NotFoundError(`Player ${userId} has never played One Button`);
    const save = obj(raw.value);

    const [refs, catalog, titleStats, allTime] = await Promise.all([
      this.playerRefs([userId]),
      this.eventCatalog(),
      this.titleStatsDoc().catch(() => null),
      this.getBoards("alltime", 100).catch(() => [] as Board[]),
    ]);

    const nowSec = Math.floor(this.now() / 1000);
    const lvl = levelInfo(num(save.exp));
    const faced = num(save.eventsFaced);
    const survived = num(save.eventsSurvived);

    const ws = obj(save.weeklyStats);
    // weeklyStats rolls over lazily: a stale `week` means nothing this week yet.
    const thisWeek =
      num(ws.week) === weekIndex(nowSec)
        ? { presses: num(ws.presses), bestStreak: num(ws.streak), survived: num(ws.survived), faced: num(ws.faced) }
        : null;

    const ranks = Object.fromEntries(
      STATS.map((s) => {
        const board = allTime.find((b) => b.stat === s.id);
        return [s.id, board?.rows.find((r) => r.userId === userId)?.rank ?? null];
      }),
    ) as Record<StatId, number | null>;

    const earned = Array.isArray(save.earnedTitles) ? save.earnedTitles.filter((t) => typeof t === "string") : [];
    const titles = [...new Set(earned as string[])]
      .map((id) => ({
        id,
        reason: TITLES.get(id)?.reason ?? null,
        rarityPercent: titleStats && titleStats.players > 0
          ? Math.min(100, ((titleStats.titles[id] ?? 0) / titleStats.players) * 100)
          : null,
      }))
      // Rarest first: the interesting ones lead.
      .sort((a, b) => (a.rarityPercent ?? 101) - (b.rarityPercent ?? 101));

    const eventStats = obj(save.eventStats);
    const events = Object.entries(eventStats).map(([id, rec]) => {
      const r = obj(rec) as EventStatRecord;
      return {
        id,
        name: catalog.get(id)?.name ?? prettifyEventId(id),
        encounters: num(r.e),
        progress: masteryProgress(id, r),
        tier: masteryTier(id, r),
      };
    });
    const tierRank = { gold: 3, silver: 2, bronze: 1 } as const;
    events.sort((a, b) => (b.tier ? tierRank[b.tier] : 0) - (a.tier ? tierRank[a.tier] : 0) || b.progress - a.progress);

    const fish = obj(save.fishLog);
    const ref = refs.get(userId)!;
    return {
      ...ref,
      level: lvl.level,
      expIntoLevel: lvl.expIntoLevel,
      expToNext: lvl.expToNext,
      totalExp: num(save.exp),
      stats: {
        presses: num(save.totalPresses),
        eventsSurvived: num(save.totalEvents),
        bestStreak: num(save.bestStreak),
        deaths: num(save.totalDeaths),
        lifetimeCoins: num(save.lifetimeEarned),
        fishCaught: Object.values(fish).reduce<number>((sum, f) => sum + num(obj(f).n), 0),
        ratio: faced > 0 ? { percent: (survived / faced) * 100, survived, faced } : null,
      },
      thisWeek,
      ranks,
      titles,
      mastery: {
        discovered: events.length,
        bronze: events.filter((e) => e.tier === "bronze").length,
        silver: events.filter((e) => e.tier === "silver").length,
        gold: events.filter((e) => e.tier === "gold").length,
        events,
      },
      updatedAt: iso(raw.fetchedAt),
      stale: raw.stale,
    };
  }

  // ── Aggregates ─────────────────────────────────────────────────────────────

  async getEventStats(): Promise<{ events: EventStat[]; totalStarts: number; updatedAt: string; stale: boolean }> {
    const [raw, catalog] = await Promise.all([
      this.cache.get("events:balance", TTL.aggregate, () =>
        this.store.getEntry(EVENT_BALANCE_STORE, EVENT_BALANCE_KEY),
      ),
      this.eventCatalog(),
    ]);
    const rows = obj(obj(raw.value).events);
    const events: EventStat[] = Object.entries(rows).map(([id, value]) => {
      const r = obj(value);
      const participants = num(r.participants);
      const survived = num(r.survived);
      const failCount = num(r.failureTimeCount);
      return {
        id,
        name: catalog.get(id)?.name ?? (typeof r.name === "string" ? r.name : prettifyEventId(id)),
        category: catalog.get(id)?.category ?? (typeof r.category === "string" ? r.category : null),
        starts: num(r.starts),
        participants,
        survived,
        failed: num(r.failed),
        survivalRate: participants > 0 ? survived / participants : null,
        avgSecondsToDeath: failCount > 0 ? num(r.failureTimeTotal) / failCount : null,
        lowSample: participants < EVENT_MIN_SAMPLE,
      };
    });
    events.sort((a, b) => b.starts - a.starts);
    return {
      events,
      totalStarts: events.reduce((sum, e) => sum + e.starts, 0),
      updatedAt: iso(raw.fetchedAt),
      stale: raw.stale,
    };
  }

  async getTitleStats(): Promise<{ players: number; titles: TitleStat[]; updatedAt: string }> {
    const doc = await this.titleStatsDoc();
    const titles = Object.entries(doc.titles)
      .map(([id, holders]) => ({
        id,
        reason: TITLES.get(id)?.reason ?? null,
        source: TITLES.get(id)?.source ?? null,
        holders,
        percent: doc.players > 0 ? Math.min(100, (holders / doc.players) * 100) : 0,
      }))
      .filter((t) => t.holders > 0)
      .sort((a, b) => a.percent - b.percent || a.id.localeCompare(b.id));
    return { players: doc.players, titles, updatedAt: doc.updatedAt };
  }

  async getOverview() {
    const [boards, events, titles] = await Promise.all([
      this.getBoards("alltime", 3),
      this.getEventStats().catch(() => null),
      this.titleStatsDoc().catch(() => null),
    ]);
    const ranked = events?.events.filter((e) => !e.lowSample && e.survivalRate !== null) ?? [];
    const byRate = [...ranked].sort((a, b) => a.survivalRate! - b.survivalRate!);
    return {
      playersCounted: titles?.players ?? null,
      totalEventsTriggered: events?.totalStarts ?? null,
      deadliestEvent: byRate[0] ?? null,
      safestEvent: byRate.at(-1) ?? null,
      boards,
    };
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async titleStatsDoc(): Promise<{ players: number; titles: Record<string, number>; updatedAt: string }> {
    const raw = await this.cache.get("titles:stats", TTL.aggregate, () =>
      this.store.getEntry(TITLE_STATS_STORE, TITLE_STATS_KEY),
    );
    const doc = obj(raw.value);
    const titles: Record<string, number> = {};
    for (const [id, n] of Object.entries(obj(doc.titles))) titles[id] = num(n);
    return { players: num(doc.players), titles, updatedAt: iso(raw.fetchedAt) };
  }

  /**
   * Live event names from EventCatalogLive. The game owns that format, so accept a
   * map keyed by id or an array of rows with an id, and fall back to nothing.
   */
  private async eventCatalog(): Promise<Map<string, { name: string; category: string | null }>> {
    const raw = await this.cache
      .get("events:catalog", TTL.catalog, () => this.store.getEntry(EVENT_CATALOG_STORE, EVENT_CATALOG_KEY))
      .catch(() => null);
    const out = new Map<string, { name: string; category: string | null }>();
    const rows = obj(raw?.value).rows ?? (raw?.value as Record<string, unknown> | undefined)?.rows;
    const add = (id: unknown, row: unknown) => {
      const r = obj(row);
      if (typeof id === "string" && typeof r.name === "string") {
        out.set(id, { name: r.name, category: typeof r.category === "string" ? r.category : null });
      }
    };
    if (Array.isArray(rows)) for (const row of rows) add(obj(row).id, row);
    else for (const [id, row] of Object.entries(obj(rows))) add(id, row);
    return out;
  }

  /** Usernames and avatars for many players at once, each list cached separately. */
  private async playerRefs(ids: number[], known = new Map<number, RobloxUser>()): Promise<Map<number, PlayerRef>> {
    const unique = [...new Set(ids)];
    const missing = unique.filter((id) => !known.has(id));
    const [users, heads] = await Promise.all([
      missing.length
        ? this.cache
            .get(`users:${missing.sort().join(",")}`, TTL.users, () => this.users.getUsers(missing))
            .then((c) => c.value)
            .catch(() => new Map<number, RobloxUser>())
        : Promise.resolve(new Map<number, RobloxUser>()),
      unique.length
        ? this.cache
            .get(`heads:${[...unique].sort().join(",")}`, TTL.users, () => this.users.getHeadshots(unique))
            .then((c) => c.value)
            .catch(() => new Map<number, string>())
        : Promise.resolve(new Map<number, string>()),
    ]);
    const out = new Map<number, PlayerRef>();
    for (const id of unique) {
      const u = known.get(id) ?? users.get(id);
      out.set(id, {
        userId: id,
        // A lookup failure must never hide a row; show the id instead.
        username: u?.name ?? `Player ${id}`,
        displayName: u?.displayName ?? u?.name ?? `Player ${id}`,
        avatarUrl: heads.get(id) ?? null,
      });
    }
    return out;
  }
}
