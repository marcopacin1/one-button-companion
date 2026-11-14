import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { CompanionService } from "./service.js";
import { MockReader, MockUserDirectory, buildMockWorld } from "./sources/mock.js";
import { OpenCloudReader } from "./sources/openCloud.js";
import { RobloxUserDirectory } from "./sources/robloxUsers.js";

const config = loadConfig();

const service =
  config.dataSource === "live"
    ? new CompanionService(new OpenCloudReader(config.apiKey, config.universeId), new RobloxUserDirectory())
    : (() => {
        const world = buildMockWorld(Math.floor(Date.now() / 1000));
        return new CompanionService(new MockReader(world), new MockUserDirectory(world));
      })();

const here = path.dirname(fileURLToPath(import.meta.url));
const app = createApp(service, {
  mode: config.dataSource,
  staticDir: path.resolve(here, "../../web/dist"),
});

app.listen(config.port, () => {
  console.log(`One Button companion API on :${config.port} (${config.dataSource} data)`);
});
