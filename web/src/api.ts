// Response shapes mirror server/src/service.ts.

export type StatId = "presses" | "events" | "streak" | "ratio";
export type Scope = "alltime" | "weekly";

export interface PlayerRef {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BoardRow extends PlayerRef {
  rank: number;
  value: number;
  sample?: number;
}

export interface Board {
  stat: StatId;
  label: string;
  scope: Scope;
  rows: BoardRow[];
  resetsAt?: string;
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

export interface Overview {
  playersCounted: number | null;
  totalEventsTriggered: number | null;
  deadliestEvent: EventStat | null;
  safestEvent: EventStat | null;
  boards: Board[];
}

export type MasteryTier = "bronze" | "silver" | "gold";

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
  ranks: Record<StatId, number | null>;
  titles: { id: string; reason: string | null; rarityPercent: number | null }[];
  mastery: {
    discovered: number;
    bronze: number;
    silver: number;
    gold: number;
    events: { id: string; name: string; encounters: number; progress: number; tier: MasteryTier | null }[];
  };
  updatedAt: string;
  stale: boolean;
}

export interface TitleStat {
  id: string;
  reason: string | null;
  source: string | null;
  holders: number;
  percent: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const api = {
  overview: (s?: AbortSignal) => get<Overview>("/overview", s),
  board: (scope: Scope, stat: StatId, s?: AbortSignal) => get<Board>(`/leaderboards/${scope}/${stat}?limit=50`, s),
  player: (id: number, s?: AbortSignal) => get<PlayerProfile>(`/players/${id}`, s),
  search: (username: string, s?: AbortSignal) =>
    get<PlayerRef>(`/players/search?username=${encodeURIComponent(username)}`, s),
  events: (s?: AbortSignal) =>
    get<{ events: EventStat[]; totalStarts: number; updatedAt: string; stale: boolean }>("/events", s),
  titles: (s?: AbortSignal) => get<{ players: number; titles: TitleStat[]; updatedAt: string }>("/titles", s),
  health: (s?: AbortSignal) => get<{ ok: boolean; mode: "mock" | "live" }>("/health", s),
};
