import { config } from "../config.js";
import { HumanitZService } from "../humanitz/service.js";
import { startDashboard } from "./server.js";

if (!config.dashboard.enabled) {
  throw new Error("Active DASHBOARD_ENABLED=1 pour lancer le panneau local.");
}

const service = new HumanitZService();
const localMonitor = {
  async tick() {
    await service.getStatus();
  }
};

await startDashboard({
  client: null,
  service,
  monitor: localMonitor,
  deployCommands: async () => null
});
