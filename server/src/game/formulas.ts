import { EXPERIENCE, MASTERY_COUNTER_OVERRIDES, MASTERY_TIERS } from "./constants.js";

// ── Weeks ────────────────────────────────────────────────────────────────────
// Constants.WeekIndex: weeks are UTC and start Monday. The unix epoch was a
// Thursday, so the game shifts by four days before dividing; a plain
// floor(t / 604800) would roll the weekly boards over mid-week.
const WEEK_SECONDS = 7 * 24 * 60 * 60;
const MONDAY_OFFSET = 4 * 24 * 60 * 60;

export function weekIndex(unixSeconds: number): number {
  return Math.floor((unixSeconds - MONDAY_OFFSET) / WEEK_SECONDS);
}

/** Unix time (seconds) when the week containing `unixSeconds` ends: next Monday 00:00 UTC. */
export function weekResetAt(unixSeconds: number): number {
  return (weekIndex(unixSeconds) + 1) * WEEK_SECONDS + MONDAY_OFFSET;
}

// ── Survival ratio ───────────────────────────────────────────────────────────
// LeaderboardService packs a ratio and its sample size into one sortable integer:
//   score = basisPoints * 100000 + min(faced, 99999)
const RATIO_SCALE = 100_000;

export interface UnpackedRatio {
  /** 0–100, two decimal places of precision (the game stores basis points). */
  percent: number;
  /** Events faced, capped at 99,999 by the encoding. */
  sample: number;
}

export function unpackRatio(score: number): UnpackedRatio {
  const s = Math.max(0, Math.floor(score));
  const basisPoints = Math.floor(s / RATIO_SCALE);
  return { percent: basisPoints / 100, sample: s % RATIO_SCALE };
}

// ── Levels ───────────────────────────────────────────────────────────────────
// ExperienceService.ExpToNext / GetLevelInfo.
export function expToNext(level: number): number {
  return Math.floor(EXPERIENCE.base * Math.pow(level, EXPERIENCE.growth));
}

export interface LevelInfo {
  level: number;
  expIntoLevel: number;
  expToNext: number;
}

export function levelInfo(totalExp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(totalExp || 0, 0);
  while (level < EXPERIENCE.maxLevel) {
    const need = expToNext(level);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }
  return {
    level,
    expIntoLevel: remaining,
    expToNext: level < EXPERIENCE.maxLevel ? expToNext(level) : 0,
  };
}

// ── Event mastery ────────────────────────────────────────────────────────────
/** One eventStats record: { e = encounters, s = survivals, t = targeted, m = claimed tier }. */
export interface EventStatRecord {
  e?: number;
  s?: number;
  t?: number;
  m?: number;
}

export type MasteryTierId = (typeof MASTERY_TIERS)[number]["id"];

export function masteryProgress(eventId: string, record: EventStatRecord): number {
  const counter = MASTERY_COUNTER_OVERRIDES[eventId] ?? "s";
  return Math.max(0, Math.floor(Number(record[counter] ?? 0)));
}

/** Highest tier reached, derived from progress exactly as the Index does. */
export function masteryTier(eventId: string, record: EventStatRecord): MasteryTierId | null {
  const progress = masteryProgress(eventId, record);
  let reached: MasteryTierId | null = null;
  for (const tier of MASTERY_TIERS) {
    if (progress >= tier.threshold) reached = tier.id;
  }
  return reached;
}

// ── Display names ────────────────────────────────────────────────────────────
/** "MeteorRainEvent" -> "Meteor Rain". Used only when the live catalog has no name. */
export function prettifyEventId(eventId: string): string {
  return eventId
    .replace(/Event$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}
