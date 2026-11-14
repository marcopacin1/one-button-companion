import {
  EVENT_BALANCE_KEY,
  EVENT_BALANCE_STORE,
  EVENT_CATALOG_KEY,
  EVENT_CATALOG_STORE,
  PLAYER_STORE,
  STATS,
  TITLE_STATS_KEY,
  TITLE_STATS_STORE,
  playerKey,
  weeklyStoreName,
} from "../game/constants.js";
import { weekIndex } from "../game/formulas.js";
import type { DataStoreReader, OrderedEntry, RobloxUser, UserDirectory } from "./types.js";

/**
 * Deterministic sample data shaped exactly like the live stores, so the whole site
 * can be built, tested and demoed without an API key. The same seed always produces
 * the same players.
 */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  "ButtonMasher42", "ChaosGoblin", "NotAPawn", "SlimeTimeSam", "TungTungTyler", "MeteorMaya",
  "DuckSeasonDan", "BubbleRacerBea", "PianoPhantom", "LagImmuneLeo", "GravityGrace", "NoobFestNate",
  "RagdollRiley", "SansSurvivor", "CoinRainCora", "TornadoTess", "FakeAdminFinn", "MirrorMilo",
  "JumpRouletteJo", "BombBirdBen", "SkibidiSkye", "FrozenLakeFox", "OrbitalOlive", "BananaPeelBo",
  "TidalTheo", "PatapimPia", "HackedHugo", "RainbowRue", "DogeWormDax", "GeyserGwen",
  "TestOfGreedTom", "PopupPenny", "BlackHoleBlu", "UFOUma", "RopedRay", "ShopCartSol",
];

const EVENTS: [string, string, string][] = [
  ["MeteorRainEvent", "☄️ Meteor Rain", "Chaos"],
  ["TornadoEvent", "🌪️ Tornado", "Chaos"],
  ["BlackHoleEvent", "🕳️ Black Hole", "Chaos"],
  ["NukeEvent", "☢️ Nuke Warning", "Chaos"],
  ["SansEvent", "💀 Sans", "Takeover"],
  ["TestOfHuntingEvent", "👁️ Test of Hunting", "Takeover"],
  ["TestOfBounceEvent", "👁️ Test of Bounce", "Takeover"],
  ["TestOfRollingEvent", "👁️ Test of Rolling", "Takeover"],
  ["TungTungEvent", "🥁 Tung Tung Tung Sahur", "Harmful"],
  ["SlimySituationEvent", "🟢 Slime Time", "Harmful"],
  ["BombRainEvent", "💣 Bomb Rain", "Harmful"],
  ["SwordRainEvent", "🗡️ Sword Rain", "Harmful"],
  ["GiantHandEvent", "🖐️ The Hand", "Harmful"],
  ["UFOAbductionEvent", "🛸 UFO Abduction", "Harmful"],
  ["BananaPeelEvent", "🍌 Banana Peels", "Troll"],
  ["FakeLagEvent", "Lag", "Troll"],
  ["PopupSpamEvent", "🪟 Popup Spam", "Troll"],
  ["MirrorWorldEvent", "🪞 Mirror World", "Troll"],
  ["CoinRainEvent", "🌧️ Coin Rain", "Helpful"],
  ["SpeedBoostEvent", "⚡ Speed Boost", "Helpful"],
  ["ForceFieldEvent", "🛡️ Force Field", "Helpful"],
  ["BeachBallEvent", "🏖️ Beach Ball Party", "Neutral"],
  ["FireworksEvent", "🎆 Fireworks Show", "Neutral"],
  ["PlaceSwapEvent", "🔀 Place Swap", "Troll"],
];

const TITLE_POOL = [
  "Rookie", "Enjoyer", "Pro", "Penny Pincher", "Coin Collector", "Money Maker", "Button Pusher",
  "Button Basher", "Button Wrecker", "Button Destroyer", "Streaker", "Unstoppable Streaker",
  "Survivor", "Meteor Master", "Twister Resister", "Bad Time Survivor", "Duck Season",
  "King of the Castle", "Hard to Swallow", "Didn't Slip", "Ping Immune", "Oops", "Unlucky",
  "Crash Test Dummy", "Walking Nugget", "Robin Hood", "Tomatotastic", "Bubble Racer",
];

interface MockPlayer {
  user: RobloxUser;
  save: Record<string, unknown>;
}

export interface MockWorld {
  players: MockPlayer[];
  ordered: Map<string, OrderedEntry[]>;
  entries: Map<string, unknown>;
}

export function buildMockWorld(nowSeconds: number, seed = 1337): MockWorld {
  const rand = mulberry32(seed);
  const int = (lo: number, hi: number) => Math.floor(lo + rand() * (hi - lo + 1));
  const week = weekIndex(nowSeconds);

  const players: MockPlayer[] = NAMES.map((name, i) => {
    // A long-tailed spread: a few grinders, many casual players.
    const dedication = Math.pow(rand(), 2.2);
    const presses = Math.round(20 + dedication * 6000);
    const faced = Math.round(presses * (0.25 + rand() * 0.2));
    const survived = Math.round(faced * (0.55 + rand() * 0.4));
    const playedThisWeek = rand() < 0.6;

    const eventStats: Record<string, { e: number; s: number; t?: number }> = {};
    for (const [id] of EVENTS) {
      if (rand() < 0.35 + dedication * 0.6) {
        const e = int(1, 4 + Math.round(dedication * 40));
        eventStats[id] = { e, s: Math.round(e * (0.4 + rand() * 0.6)) };
        if (id === "PlaceSwapEvent") eventStats[id]!.t = int(0, e);
      }
    }

    const earnedTitles = ["Noob", ...TITLE_POOL.filter(() => rand() < 0.2 + dedication * 0.6)];

    const save = {
      coins: int(0, 40_000),
      exp: Math.round(presses * (8 + rand() * 6)),
      streak: 0,
      bestStreak: int(1, 8 + Math.round(dedication * 70)),
      totalPresses: presses,
      totalEvents: survived + int(0, 40),
      totalDeaths: faced - survived + int(0, 20),
      eventsFaced: faced,
      eventsSurvived: survived,
      weeklyStats: playedThisWeek
        ? {
            week,
            presses: int(5, Math.max(6, Math.round(presses / 8))),
            streak: int(1, 25),
            faced: int(3, 60),
            survived: 0,
          }
        : { week: week - int(1, 6), presses: 12, streak: 3, faced: 9, survived: 5 },
      earnedTitles,
      lifetimeEarned: Math.round(presses * (25 + rand() * 30)),
      eventStats,
      fishLog: rand() < 0.4 ? { carp: { n: int(1, 9), kg: 2.4 }, swamp_eel: { n: int(1, 3), kg: 5.1 } } : {},
      dataVersion: 2,
    };
    const ws = save.weeklyStats as { faced: number; survived: number };
    ws.survived = Math.round(ws.faced * (0.5 + rand() * 0.45));

    return { user: { id: 100_000 + i * 7919, name, displayName: name.replace(/\d+$/, "") }, save };
  });

  // ── Leaderboards, written the way LeaderboardService writes them ─────────────
  const ordered = new Map<string, OrderedEntry[]>();
  const push = (store: string, id: number, value: number | null) => {
    if (value === null || value <= 0) return;
    const list = ordered.get(store) ?? [];
    list.push({ id: String(id), value });
    ordered.set(store, list);
  };
  const pack = (survived: number, faced: number) =>
    faced <= 0 ? null : Math.round((survived / faced) * 10000) * 100_000 + Math.min(faced, 99_999);

  for (const { user, save } of players) {
    const s = save as {
      totalPresses: number; totalEvents: number; bestStreak: number;
      eventsFaced: number; eventsSurvived: number;
      weeklyStats: { week: number; presses: number; streak: number; faced: number; survived: number };
    };
    push("LB_Presses_v1", user.id, s.totalPresses);
    push("LB_Events_v1", user.id, s.totalEvents);
    push("LB_Streak_v1", user.id, s.bestStreak);
    push("LB_Ratio_v1", user.id, s.eventsFaced >= 25 ? pack(s.eventsSurvived, s.eventsFaced) : null);
    if (s.weeklyStats.week === week) {
      const w = s.weeklyStats;
      push(weeklyStoreName("presses", week), user.id, w.presses);
      push(weeklyStoreName("events", week), user.id, w.survived);
      push(weeklyStoreName("streak", week), user.id, w.streak);
      push(weeklyStoreName("ratio", week), user.id, w.faced >= 8 ? pack(w.survived, w.faced) : null);
    }
  }
  // The live all-time boards really did carry Studio test players (UserId -1, -2…);
  // keep two here so the filter that removes them stays tested.
  push("LB_Presses_v1", -1, 166);
  push("LB_Streak_v1", -2, 38);
  for (const list of ordered.values()) list.sort((a, b) => b.value - a.value);

  // ── Standard entries ─────────────────────────────────────────────────────────
  const entries = new Map<string, unknown>();
  for (const p of players) entries.set(`${PLAYER_STORE}/${playerKey(p.user.id)}`, p.save);

  const balance: Record<string, Record<string, unknown>> = {};
  for (const [id, name, category] of EVENTS) {
    const starts = int(3, 120);
    const participants = starts * int(2, 6);
    const lethality = category === "Helpful" ? 0.03 : category === "Takeover" ? 0.55 : 0.1 + rand() * 0.45;
    const failed = Math.round(participants * lethality);
    balance[id] = {
      name, category, starts, completed: starts - int(0, 2), participants,
      survived: participants - failed, failed, disconnected: int(0, 3), cancelled: 0,
      failureTimeTotal: failed * (5 + rand() * 40), failureTimeCount: failed,
      durationTotal: starts * 40, durationCount: starts,
    };
  }
  entries.set(`${EVENT_BALANCE_STORE}/${EVENT_BALANCE_KEY}`, {
    schema: 1, revision: "2026-09-19-v1", generation: 1, updatedAt: nowSeconds - 120, events: balance,
  });

  const titleCounts: Record<string, number> = {};
  for (const p of players) {
    for (const t of p.save.earnedTitles as string[]) titleCounts[t] = (titleCounts[t] ?? 0) + 1;
  }
  entries.set(`${TITLE_STATS_STORE}/${TITLE_STATS_KEY}`, { players: players.length + 14, titles: titleCounts });

  entries.set(`${EVENT_CATALOG_STORE}/${EVENT_CATALOG_KEY}`, {
    rows: Object.fromEntries(EVENTS.map(([id, name, category]) => [id, { name, category }])),
  });

  // Sanity: every stat has an all-time store, even if empty.
  for (const s of STATS) if (!ordered.has(s.store)) ordered.set(s.store, []);

  return { players, ordered, entries };
}

export class MockReader implements DataStoreReader {
  constructor(private readonly world: MockWorld) {}

  async listOrdered(store: string, limit: number): Promise<OrderedEntry[]> {
    return (this.world.ordered.get(store) ?? []).slice(0, limit);
  }

  async getEntry(store: string, key: string): Promise<unknown | null> {
    const v = this.world.entries.get(`${store}/${key}`);
    return v === undefined ? null : structuredClone(v);
  }
}

export class MockUserDirectory implements UserDirectory {
  private readonly byId: Map<number, RobloxUser>;

  constructor(world: MockWorld) {
    this.byId = new Map(world.players.map((p) => [p.user.id, p.user]));
  }

  async getUsers(ids: number[]): Promise<Map<number, RobloxUser>> {
    const out = new Map<number, RobloxUser>();
    for (const id of ids) {
      const u = this.byId.get(id);
      if (u) out.set(id, u);
    }
    return out;
  }

  async findByUsername(username: string): Promise<RobloxUser | null> {
    const lower = username.toLowerCase();
    for (const u of this.byId.values()) if (u.name.toLowerCase() === lower) return u;
    return null;
  }

  /** No real avatars for invented players; the frontend draws an initial instead. */
  async getHeadshots(): Promise<Map<number, string>> {
    return new Map();
  }
}
