# One Button Lounge

A companion site for **[One Button](https://www.roblox.com/games/121388633171828)**, a multiplayer Roblox game where pressing a single button sets off one of 140+ random events. The site shows live leaderboards, a profile for every player, how deadly each event really is, and how rare each title is. It reads all of this straight from the game's own DataStores through Roblox Open Cloud.

**Stack:** TypeScript end to end. React 19 + Vite on the frontend, Node + Express 5 on the backend, Vitest + Supertest for tests.

## What it does

- **Leaderboards:** all-time and weekly boards for presses, events survived, best streak and survival ratio. They are read from the same OrderedDataStores that fill the physical boards in the in-game lounge, so the site and the game always agree.
- **Player profiles:** search any Roblox username to see that player's level, stats, global ranks, titles (rarest first) and event-mastery medals.
- **Event stats:** survival rate and average time to death for every event, aggregated across all servers.
- **Title rarity:** the share of all players who hold each title.
- **Press the button:** the home page's button rolls a real event, weighted by how often each event has actually fired, and shows how players fare against it.

## How it works

```
Browser ──► Express API ──► TTL cache ──► DataStoreReader ──► Roblox Open Cloud v2
                                        └► UserDirectory  ──► users / thumbnails APIs
```

- **The game does the aggregation, so the site never scans player data.** The game already writes pre-ranked OrderedDataStores and two summary documents (event balance, title rarity), so every page costs a handful of reads no matter how many people have played.
- **The game's formulas are ported, not approximated.** Week numbering (UTC Monday rollover, offset from the Thursday epoch), the packed ratio score (`basisPoints × 100000 + sample`), the level curve and the mastery thresholds mirror the Luau source. Tests pin them against values read from Roblox Studio.
- **The cache protects Roblox's rate limits.** Concurrent requests for the same data share one upstream call, and if Roblox fails, the last good data is served and marked stale instead of showing an error.
- **Data sources are swappable.** `DataStoreReader` has a live Open Cloud implementation and a deterministic mock, so the app can be developed, tested and demoed without credentials.
- **The key is least-privilege.** The Open Cloud key is read-only and scoped to one experience, so the site cannot modify player data.
- **Studio test accounts are filtered out.** Rows with non-positive UserIds, which Studio playtests leave on the real boards, are dropped.

## Running it

```bash
npm install
cp .env.example .env      # DATA_SOURCE=mock works with no key
npm run dev               # API on :3001, site on http://localhost:5173
npm test                  # server test suite
```

To use real data, set `DATA_SOURCE=live` and `ROBLOX_API_KEY` in `.env`. The key needs **read** access to `universe-datastores` and `ordered-data-stores`, scoped to the One Button experience.

## Deploying

`render.yaml` deploys the whole thing as one Render web service: the API serves the built frontend. Create a Render Blueprint from this repo and set `ROBLOX_API_KEY` in the dashboard.

## Layout

```
server/src
  game/        constants and formulas mirrored from the game's Luau source
  sources/     Open Cloud client, Roblox users client, mock world
  cache.ts     TTL cache with request coalescing and stale fallback
  service.ts   turns raw DataStore records into the API's responses
  app.ts       routes, validation, rate limiting, error mapping
web/src
  pages/       Home, Leaderboards, Player, Events, Titles
  components/  The button, billing boards, search
```
