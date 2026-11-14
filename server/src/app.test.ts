import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { CompanionService } from "./service.js";
import { MockReader, MockUserDirectory, buildMockWorld } from "./sources/mock.js";
import { OpenCloudReader } from "./sources/openCloud.js";

const NOW = Date.UTC(2026, 10, 14, 17, 36);
const world = buildMockWorld(NOW / 1000);
const app = createApp(new CompanionService(new MockReader(world), new MockUserDirectory(world), () => NOW), {
  mode: "mock",
});
const somePlayer = world.players[3]!;

describe("API on mock data", () => {
  it("serves health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toEqual({ ok: true, mode: "mock" });
  });

  describe("leaderboards", () => {
    let boards: { stat: string; rows: { userId: number; value: number; rank: number; sample?: number }[] }[];
    beforeAll(async () => {
      boards = (await request(app).get("/api/leaderboards/alltime")).body.boards;
    });

    it("returns all four stats, ranked high to low", () => {
      expect(boards.map((b) => b.stat)).toEqual(["presses", "events", "streak", "ratio"]);
      for (const b of boards) {
        const values = b.rows.map((r) => r.value);
        expect(values).toEqual([...values].sort((x, y) => y - x));
        expect(b.rows.map((r) => r.rank)).toEqual(b.rows.map((_, i) => i + 1));
      }
    });

    it("drops Studio test players (UserId <= 0)", () => {
      for (const b of boards) expect(b.rows.every((r) => r.userId > 0)).toBe(true);
    });

    it("unpacks the ratio board into a percentage plus its sample", () => {
      const ratio = boards.find((b) => b.stat === "ratio")!;
      expect(ratio.rows.length).toBeGreaterThan(0);
      for (const r of ratio.rows) {
        expect(r.value).toBeGreaterThanOrEqual(0);
        expect(r.value).toBeLessThanOrEqual(100);
        expect(r.sample).toBeGreaterThanOrEqual(25);
      }
    });

    it("gives weekly boards a Monday reset time", async () => {
      const res = await request(app).get("/api/leaderboards/weekly/presses");
      expect(res.status).toBe(200);
      expect(res.body.resetsAt).toBe("2026-11-16T00:00:00.000Z");
    });

    it("rejects unknown scopes and stats", async () => {
      expect((await request(app).get("/api/leaderboards/monthly")).status).toBe(400);
      expect((await request(app).get("/api/leaderboards/alltime/coins")).status).toBe(400);
    });
  });

  describe("players", () => {
    it("finds a player by username, case-insensitively", async () => {
      const res = await request(app).get(`/api/players/search?username=${somePlayer.user.name.toUpperCase()}`);
      expect(res.status).toBe(200);
      expect(res.body.userId).toBe(somePlayer.user.id);
    });

    it("rejects malformed usernames before calling Roblox", async () => {
      for (const bad of ["", "ab", "has space", "x".repeat(21), "<script>"]) {
        const res = await request(app).get(`/api/players/search?username=${encodeURIComponent(bad)}`);
        expect(res.status).toBe(400);
      }
    });

    it("404s for a user who has never played", async () => {
      expect((await request(app).get("/api/players/search?username=NobodyAtAll")).status).toBe(404);
      expect((await request(app).get("/api/players/12345")).status).toBe(404);
    });

    it("builds a profile consistent with the save", async () => {
      const res = await request(app).get(`/api/players/${somePlayer.user.id}`);
      expect(res.status).toBe(200);
      const save = somePlayer.save as { totalPresses: number; eventsFaced: number; eventsSurvived: number };
      expect(res.body.stats.presses).toBe(save.totalPresses);
      expect(res.body.stats.ratio.percent).toBeCloseTo((save.eventsSurvived / save.eventsFaced) * 100);
      expect(res.body.level).toBeGreaterThanOrEqual(1);
      // Titles are sorted rarest first.
      const rarities = res.body.titles.map((t: { rarityPercent: number }) => t.rarityPercent);
      expect(rarities).toEqual([...rarities].sort((a: number, b: number) => a - b));
    });

    it("rejects non-numeric ids", async () => {
      expect((await request(app).get("/api/players/abc")).status).toBe(400);
      expect((await request(app).get("/api/players/-1")).status).toBe(400);
    });
  });

  it("serves event stats with survival rates", async () => {
    const res = await request(app).get("/api/events");
    expect(res.body.events.length).toBeGreaterThan(10);
    for (const e of res.body.events) {
      if (e.survivalRate !== null) expect(e.survivalRate).toBeLessThanOrEqual(1);
    }
  });

  it("serves title rarity, rarest first", async () => {
    const res = await request(app).get("/api/titles");
    const pct = res.body.titles.map((t: { percent: number }) => t.percent);
    expect(pct).toEqual([...pct].sort((a: number, b: number) => a - b));
  });
});

describe("OpenCloudReader", () => {
  it("sends the key, asks for value desc, and parses entries", async () => {
    let seen: { url: string; key: string | null } | undefined;
    const fakeFetch = (async (url: URL, init: RequestInit) => {
      seen = { url: url.toString(), key: new Headers(init.headers).get("x-api-key") };
      return new Response(JSON.stringify({ orderedDataStoreEntries: [{ id: "77", value: "512" }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const reader = new OpenCloudReader("secret", "10200693154", fakeFetch);
    const rows = await reader.listOrdered("LB_Presses_v1", 10);
    expect(rows).toEqual([{ id: "77", value: 512 }]);
    expect(seen!.key).toBe("secret");
    expect(seen!.url).toContain("/universes/10200693154/ordered-data-stores/LB_Presses_v1/scopes/global/entries");
    expect(seen!.url).toContain("orderBy=value+desc");
  });

  it("treats a missing store or key as empty, and an auth failure as an upstream error", async () => {
    const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    const reader404 = new OpenCloudReader("k", "1", notFound);
    expect(await reader404.listOrdered("LBW_presses_v1_9999", 10)).toEqual([]);
    expect(await reader404.getEntry("OneButtonPlayerData_v1", "player_1")).toBeNull();

    const forbidden = (async () => new Response("Insufficient scope", { status: 403 })) as unknown as typeof fetch;
    await expect(new OpenCloudReader("k", "1", forbidden).getEntry("x", "y")).rejects.toThrow(/permissions/);
  });
});
