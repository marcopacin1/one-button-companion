import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env"), quiet: true });

export interface Config {
  dataSource: "mock" | "live";
  apiKey: string;
  universeId: string;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const dataSource = (env.DATA_SOURCE ?? "mock").toLowerCase();
  if (dataSource !== "mock" && dataSource !== "live") {
    throw new Error(`DATA_SOURCE must be "mock" or "live", got "${env.DATA_SOURCE}"`);
  }
  const apiKey = env.ROBLOX_API_KEY ?? "";
  const universeId = env.ROBLOX_UNIVERSE_ID ?? "10200693154";
  if (dataSource === "live" && !apiKey) {
    throw new Error("DATA_SOURCE=live needs ROBLOX_API_KEY. Set DATA_SOURCE=mock to run without one.");
  }
  if (!/^\d+$/.test(universeId)) throw new Error("ROBLOX_UNIVERSE_ID must be numeric");
  return { dataSource, apiKey, universeId, port: Number(env.PORT ?? 3001) };
}
