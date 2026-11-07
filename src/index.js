import { ActivityType, Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config.js";
import { deployCommands } from "./discord/commands.js";
import { createInteractionHandler } from "./discord/interactions.js";
import { HumanitZMonitor } from "./humanitz/monitor.js";
import { HumanitZService } from "./humanitz/service.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const service = new HumanitZService();
const monitor = new HumanitZMonitor(client, service);

client.once("clientReady", async () => {
  client.user.setPresence({
    activities: [{ name: "HumanitZ | Secteur surveille", type: ActivityType.Playing }],
    status: "online"
  });

  console.log(`Bot connecte: ${client.user.tag}`);
  await deployCommands(client.user.id);
  monitor.start();
  console.log("Commandes R.A.D.A.R. synchronisees.");
  console.log("Surveillance HumanitZ active.");
});

client.on(Events.InteractionCreate, createInteractionHandler({ client, service, monitor }));

client.login(config.discord.token).catch((error) => {
  console.error("Connexion Discord impossible:", error.message);
  process.exitCode = 1;
});
