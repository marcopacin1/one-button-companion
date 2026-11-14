import { describe, expect, it } from "vitest";
import {
  expToNext,
  levelInfo,
  masteryTier,
  prettifyEventId,
  unpackRatio,
  weekIndex,
  weekResetAt,
} from "./formulas.js";

describe("weekIndex", () => {
  it("rolls over at Monday 00:00 UTC, not on the epoch's Thursday", () => {
    const sundayNight = Date.UTC(2026, 10, 15, 23, 59, 59) / 1000; // Sun 15 Nov 2026
    const mondayMidnight = Date.UTC(2026, 10, 16, 0, 0, 0) / 1000; // Mon 16 Nov 2026
    expect(weekIndex(mondayMidnight)).toBe(weekIndex(sundayNight) + 1);
    // And not on Thursday, which a naive floor(t / 604800) would do.
    const wed = Date.UTC(2026, 10, 18, 23, 59, 59) / 1000;
    const thu = Date.UTC(2026, 10, 19, 0, 0, 0) / 1000;
    expect(weekIndex(thu)).toBe(weekIndex(wed));
  });

  it("agrees with the game's Constants.WeekIndex (values read from Studio)", () => {
    expect(weekIndex(1789561800)).toBe(2958); // 2026-09-16T12:30Z
    expect(weekIndex(1794700799)).toBe(2966); // 2026-11-14T23:59:59Z
    expect(weekResetAt(1794700799)).toBe(1794787200); // Constants.WeekResetAt
  });

  it("reports the reset as the next Monday 00:00 UTC", () => {
    const sat = Date.UTC(2026, 10, 14, 17, 36) / 1000;
    expect(new Date(weekResetAt(sat) * 1000).toISOString()).toBe("2026-11-16T00:00:00.000Z");
  });
});

describe("unpackRatio", () => {
  it("reverses LeaderboardService.packRatio", () => {
    // 94.2% of 1,200 -> 9420 * 100000 + 1200
    expect(unpackRatio(9420 * 100_000 + 1200)).toEqual({ percent: 94.2, sample: 1200 });
    expect(unpackRatio(10_000 * 100_000 + 99_999)).toEqual({ percent: 100, sample: 99_999 });
  });

  it("keeps the game's tie-break: more events wins at the same percentage", () => {
    const big = 10_000 * 100_000 + 800;
    const small = 10_000 * 100_000 + 25;
    expect(big).toBeGreaterThan(small);
    expect(unpackRatio(big).percent).toBe(unpackRatio(small).percent);
  });
});

describe("levelInfo", () => {
  it("matches ExperienceService.GetLevelInfo at the boundaries", () => {
    expect(levelInfo(0)).toEqual({ level: 1, expIntoLevel: 0, expToNext: 10 });
    expect(levelInfo(9).level).toBe(1);
    expect(levelInfo(10)).toEqual({ level: 2, expIntoLevel: 0, expToNext: expToNext(2) });
    expect(expToNext(2)).toBe(Math.floor(10 * 2 ** 1.1)); // 21
  });

  it("treats missing or negative exp as zero", () => {
    expect(levelInfo(-50).level).toBe(1);
    expect(levelInfo(Number.NaN).level).toBe(1);
  });
});

describe("masteryTier", () => {
  it("uses survivals by default and the per-event override otherwise", () => {
    expect(masteryTier("MeteorRainEvent", { e: 40, s: 4 })).toBe("bronze");
    expect(masteryTier("MeteorRainEvent", { e: 40, s: 5 })).toBe("silver");
    expect(masteryTier("MeteorRainEvent", { s: 15 })).toBe("gold");
    expect(masteryTier("MeteorRainEvent", { e: 3, s: 0 })).toBeNull();
    // Group heal counts encounters; Place Swap counts times targeted.
    expect(masteryTier("HealAllPlayersEvent", { e: 5, s: 0 })).toBe("silver");
    expect(masteryTier("PlaceSwapEvent", { e: 30, s: 30, t: 0 })).toBeNull();
  });
});

describe("prettifyEventId", () => {
  it("turns module names into readable names", () => {
    expect(prettifyEventId("MeteorRainEvent")).toBe("Meteor Rain");
    expect(prettifyEventId("UFOAbductionEvent")).toBe("UFO Abduction");
    expect(prettifyEventId("TestOfHuntingEvent")).toBe("Test Of Hunting");
  });
});
