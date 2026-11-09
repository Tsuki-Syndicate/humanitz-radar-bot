import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { deployCommands } from "./discord/commands.js";
import { ensureControlPanel } from "./discord/control-panel.js";
import { ensureInformationPortals } from "./discord/information-portals.js";
import { ensureActivityRolePanel } from "./discord/activity-roles.js";
import { createInteractionHandler } from "./discord/interactions.js";
import { registerMemberEvents } from "./discord/members.js";
import { HumanitZMonitor } from "./humanitz/monitor.js";
import { DailyRestartScheduler } from "./humanitz/restart-scheduler.js";
import { HumanitZService } from "./humanitz/service.js";
import { startDashboard } from "./dashboard/server.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const service = new HumanitZService();
const monitor = new HumanitZMonitor(client, service);
const restartScheduler = new DailyRestartScheduler(client, service);

client.once("clientReady", async () => {
  client.user.setPresence({
    activities: [{ name: "HumanitZ | Secteur surveille", type: ActivityType.Playing }],
    status: "online"
  });

  console.log(`Bot connecte: ${client.user.tag}`);
  try {
    await deployCommands(client.user.id);
    await ensureControlPanel(client);
    await ensureActivityRolePanel(client);
    await ensureInformationPortals(client);
    monitor.start();
    await restartScheduler.start();
    await startDashboard({ client, service, monitor, deployCommands });
    console.log("Commandes R.A.D.A.R. synchronisees.");
    console.log("Surveillance HumanitZ active.");
  } catch (error) {
    console.error("Initialisation R.A.D.A.R. incomplete:", error.message);
  }
});

client.on(Events.InteractionCreate, createInteractionHandler({ client, service, monitor }));
registerMemberEvents(client);

client.login(config.discord.token).catch((error) => {
  console.error("Connexion Discord impossible:", error.message);
  process.exitCode = 1;
});
