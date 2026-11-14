/**
 * Names and shapes that mirror the live game. Each one is copied from the Luau source
 * it names, so if the game changes, this is the one file to update.
 */

/** LeaderboardService.STATS (ServerScriptService.Services.LeaderboardService). */
export const STATS = [
  { id: "presses", label: "Presses", store: "LB_Presses_v1" },
  { id: "events", label: "Events Survived", store: "LB_Events_v1" },
  { id: "streak", label: "Best Streak", store: "LB_Streak_v1" },
  { id: "ratio", label: "Survival Ratio", store: "LB_Ratio_v1", minSample: 25, minSampleWeekly: 8 },
] as const;

export type StatId = (typeof STATS)[number]["id"];
export type Scope = "alltime" | "weekly";

export const STAT_IDS: readonly StatId[] = STATS.map((s) => s.id);

export function isStatId(value: string): value is StatId {
  return (STAT_IDS as readonly string[]).includes(value);
}

export function isScope(value: string): value is Scope {
  return value === "alltime" || value === "weekly";
}

/** LeaderboardService weeklyStoreName: string.format("LBW_%s_v1_%d", stat.id, week). */
export function weeklyStoreName(stat: StatId, week: number): string {
  return `LBW_${stat}_v1_${week}`;
}

export function storeNameFor(stat: StatId, scope: Scope, week: number): string {
  if (scope === "weekly") return weeklyStoreName(stat, week);
  const def = STATS.find((s) => s.id === stat);
  if (!def) throw new Error(`Unknown stat ${stat}`);
  return def.store;
}

/** GameConfig.DataStore.StoreName; DataService keys saves as "player_<userId>". */
export const PLAYER_STORE = "OneButtonPlayerData_v1";
export const playerKey = (userId: number) => `player_${userId}`;

/** EventBalanceService: STORE_NAME and STORE_KEY ("revision:" .. BALANCE_REVISION). */
export const EVENT_BALANCE_STORE = "OneButtonEventBalance_v1";
export const EVENT_BALANCE_KEY = "revision:2026-09-19-v1";

/** TitleStatsService: one global document. */
export const TITLE_STATS_STORE = "TitleStats_v1";
export const TITLE_STATS_KEY = "global";

/** IndexService reads live event metadata from here; key "v1", field `rows`. */
export const EVENT_CATALOG_STORE = "EventCatalogLive";
export const EVENT_CATALOG_KEY = "v1";

/** GameConfig.Progression.EventMastery.Tiers. */
export const MASTERY_TIERS = [
  { id: "bronze", name: "Bronze", threshold: 1 },
  { id: "silver", name: "Silver", threshold: 5 },
  { id: "gold", name: "Gold", threshold: 15 },
] as const;

/**
 * GameConfig.Progression.EventMastery.CompletionStatByEvent. Most events count
 * survivals ("s"); a few count encounters ("e") or times targeted ("t").
 */
export const MASTERY_COUNTER_OVERRIDES: Record<string, "e" | "s" | "t"> = {
  ExplodeRandomPlayerEvent: "t",
  PlaceSwapEvent: "t",
  HealAllPlayersEvent: "e",
  SingleThunderStrikeEvent: "s",
};

/** GameConfig.Progression.Experience. */
export const EXPERIENCE = { base: 10, growth: 1.1, maxLevel: 999 } as const;
