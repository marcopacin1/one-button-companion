import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { existsSync } from "node:fs";
import path from "node:path";
import { isScope, isStatId } from "./game/constants.js";
import { type CompanionService, NotFoundError } from "./service.js";
import { UpstreamError } from "./sources/types.js";

// Roblox usernames: 3–20 characters, letters, digits and at most one underscore.
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

export interface AppOptions {
  /** Directory of the built frontend to serve, if any. */
  staticDir?: string;
  mode: "mock" | "live";
}

export function createApp(service: CompanionService, opts: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render/Fly sit behind one proxy hop

  const api = express.Router();
  // Every request may cost an Open Cloud call on a cache miss; cap any one client.
  api.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));
  api.use((_req, res, next) => {
    res.set("Cache-Control", "public, max-age=30");
    next();
  });

  api.get("/health", (_req, res) => {
    res.json({ ok: true, mode: opts.mode });
  });

  api.get("/overview", async (_req, res) => {
    res.json(await service.getOverview());
  });

  api.get("/leaderboards/:scope", async (req, res) => {
    const { scope } = req.params;
    if (!isScope(scope)) return void res.status(400).json({ error: "scope must be alltime or weekly" });
    res.json({ boards: await service.getBoards(scope, 10) });
  });

  api.get("/leaderboards/:scope/:stat", async (req, res) => {
    const { scope, stat } = req.params;
    if (!isScope(scope)) return void res.status(400).json({ error: "scope must be alltime or weekly" });
    if (!isStatId(stat)) return void res.status(400).json({ error: "unknown stat" });
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50) || 50));
    res.json(await service.getBoard(stat, scope, limit));
  });

  api.get("/players/search", async (req, res) => {
    const username = String(req.query.username ?? "").trim();
    if (!USERNAME.test(username)) return void res.status(400).json({ error: "That isn't a valid Roblox username" });
    res.json(await service.findPlayer(username));
  });

  api.get("/players/:userId", async (req, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) return void res.status(400).json({ error: "Invalid user id" });
    res.json(await service.getPlayer(userId));
  });

  api.get("/events", async (_req, res) => {
    res.json(await service.getEventStats());
  });

  api.get("/titles", async (_req, res) => {
    res.json(await service.getTitleStats());
  });

  api.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use("/api", api);

  // ── Frontend (production build) ──────────────────────────────────────────────
  if (opts.staticDir && existsSync(opts.staticDir)) {
    const dir = opts.staticDir;
    app.use(express.static(dir, { maxAge: "1h", index: false }));
    // Client-side routes (/player/123) all serve the SPA shell.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(dir, "index.html"));
    });
  }

  // ── Errors ──────────────────────────────────────────────────────────────────
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    if (err instanceof UpstreamError) {
      console.error(err.message);
      const status = err.status === 429 ? 503 : 502;
      return void res.status(status).json({ error: "Roblox didn't answer. Try again in a minute." });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
