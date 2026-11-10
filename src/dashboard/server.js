import { fileURLToPath } from "node:url";
import path from "node:path";
import express from "express";
import { ActivityType } from "discord.js";
import { config } from "../config.js";
import { sendLog } from "../discord/logs.js";
import { dashboardAuth, dashboardCsrf, dashboardPageAuth, mountDashboardAuth } from "./auth.js";

const dashboardDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.join(dashboardDirectory, "public");
const WEATHER_OPTIONS = ["clear", "partly_cloudy", "overcast", "foggy", "light_rain", "rain", "thunder", "snow", "blizzard"];
const SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"];
const PLAYER_ACTIONS = ["kick", "ban", "unban", "unstuck", "teleport"];
const actionWindows = new Map();

function loopbackHost(host) {
  return ["127.0.0.1", "::1", "localhost"].includes(host.toLowerCase());
}

function text(value, maximum = 180) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\r\n]+/g, " ").trim();
  return normalized && normalized.length <= maximum ? normalized : null;
}

function integer(value, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function playerIdentifier(value) {
  return typeof value === "string" && /^[A-Za-z0-9_+|:-]{3,128}$/.test(value) ? value : null;
}

function resourceCode(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : null;
}

function sanitizeOutput(value) {
  return String(value || "Aucune reponse du serveur.")
    .replace(/\u0000/g, "")
    .slice(0, 4_000);
}

function snapshotPayload(snapshot, latencyMs) {
  return {
    online: true,
    latencyMs,
    checkedAt: new Date().toISOString(),
    name: snapshot.name,
    uptime: snapshot.uptime,
    connected: snapshot.connected,
    season: snapshot.season,
    weather: snapshot.weather,
    time: snapshot.time,
    ai: snapshot.ai,
    players: snapshot.playerRecords.map((player) => ({
      name: player.name,
      identifier: player.identifier,
      position: null
    })),
    positionsAvailable: false
  };
}

function actor(request) {
  return request.dashboardUser?.username || "Administrateur inconnu";
}

async function audit(client, request, action, color = 0x5bce77) {
  if (!client?.channels?.fetch) return;
  await sendLog(client, "R.A.D.A.R. | Panneau web", `**${actor(request)}**: ${action}`, color);
}

function botAvailable(client) {
  return Boolean(client?.user);
}

function apiError(response, error, fallback = "Action non executee. Verifie la connexion au serveur.") {
  console.error("Panneau R.A.D.A.R.:", error.message);
  response.status(502).json({ error: fallback });
}

function apiAction(handler) {
  return async (request, response) => {
    try {
      await handler(request, response);
    } catch (error) {
      apiError(response, error);
    }
  };
}

function requireConfirmation(request, response, phrase = null) {
  if (request.body?.confirmed !== true || (phrase && request.body?.confirmation !== phrase)) {
    response.status(400).json({ error: "Confirmation requise avant cette action." });
    return false;
  }
  return true;
}

function rateLimit(request, response, next) {
  if (request.method === "GET" || request.method === "HEAD") {
    next();
    return;
  }

  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const events = (actionWindows.get(key) || []).filter((time) => now - time < 60_000);
  if (events.length >= 45) {
    response.status(429).json({ error: "Trop d'actions en une minute. Patiente un instant." });
    return;
  }
  events.push(now);
  actionWindows.set(key, events);
  next();
}

function addHeaders(request, response, next) {
  response.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self' https://cdn.discordapp.com; img-src 'self' https://cdn.discordapp.com https://humanitz.codexery.com data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
  });
  next();
}

export async function startDashboard({ client, service, monitor, deployCommands }) {
  if (!config.dashboard.enabled) return null;
  if (config.dashboard.devBypass && !loopbackHost(config.dashboard.host)) {
    throw new Error("DASHBOARD_DEV_BYPASS exige DASHBOARD_HOST=127.0.0.1, localhost ou ::1.");
  }
  if (!config.dashboard.devBypass && !config.dashboard.oauthConfigured) {
    throw new Error("Le panneau public exige les variables OAuth Discord et DASHBOARD_SESSION_SECRET.");
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(addHeaders);
  app.use(express.json({ limit: "12kb" }));

  mountDashboardAuth(app, client);
  app.get("/healthz", (request, response) => response.json({ ok: true }));

  const api = express.Router();
  api.use(dashboardAuth, dashboardCsrf, rateLimit);

  api.get("/session", (request, response) => {
    const botAvatar = client?.user?.displayAvatarURL({ extension: "png", size: 128 }) || null;
    response.json({
      user: { username: actor(request), avatar: request.dashboardUser?.avatar || null },
      csrf: request.dashboardUser.csrf,
      localMode: config.dashboard.devBypass,
      bot: { name: client?.user?.username || "R.A.D.A.R.", avatar: botAvatar },
      features: { rawConsole: true, botManagement: botAvailable(client) }
    });
  });

  api.get("/status", apiAction(async (request, response) => {
    const startedAt = Date.now();
    const snapshot = await service.getStatus();
    response.json(snapshotPayload(snapshot, Date.now() - startedAt));
  }));

  api.get("/map", apiAction(async (request, response) => {
    const snapshot = await service.getMapSnapshot();
    response.json({
      checkedAt: snapshot.checkedAt,
      bounds: config.humanitz.mapBounds,
      players: snapshot.players.filter((player) => player.position)
    });
  }));

  api.post("/monitor/refresh", apiAction(async (request, response) => {
    await monitor.tick();
    await audit(client, request, "mise a jour manuelle du statut Discord.");
    response.json({ ok: true, message: "Statut Discord actualise." });
  }));

  api.post("/server/announce", apiAction(async (request, response) => {
    const message = text(request.body?.message, 180);
    if (!message) {
      response.status(400).json({ error: "Message requis (180 caracteres maximum)." });
      return;
    }
    await service.announce(message);
    await audit(client, request, "annonce envoyee dans le serveur HumanitZ.");
    response.json({ ok: true, message: "Annonce transmise au serveur." });
  }));

  api.post("/server/restart", apiAction(async (request, response) => {
    if (!requireConfirmation(request, response)) return;
    const minutes = integer(request.body?.minutes, 1, 120);
    if (!minutes) {
      response.status(400).json({ error: "Choisis un delai entre 1 et 120 minutes." });
      return;
    }
    await service.restart(minutes);
    const message = `Redemarrage du serveur dans ${minutes} minute(s). Mettez-vous en securite.`;
    await service.announce(message);
    await audit(client, request, `redemarrage programme dans ${minutes} minute(s).`, 0xf9a825);
    response.json({ ok: true, message: `Redemarrage programme dans ${minutes} minute(s).` });
  }));

  api.post("/server/restart-now", apiAction(async (request, response) => {
    if (!requireConfirmation(request, response, "REDEMARRER")) return;
    await service.restartNow();
    await audit(client, request, "redemarrage immediat transmis.", 0xd32f2f);
    response.json({ ok: true, message: "Redemarrage immediat transmis au serveur." });
  }));

  api.post("/server/cancel-restart", apiAction(async (request, response) => {
    if (!requireConfirmation(request, response)) return;
    await service.cancelRestart();
    await audit(client, request, "redemarrage programme annule.", 0xf9a825);
    response.json({ ok: true, message: "Redemarrage programme annule." });
  }));

  api.post("/server/shutdown", apiAction(async (request, response) => {
    if (!requireConfirmation(request, response, "ARRETER")) return;
    await service.shutdown();
    await audit(client, request, "arret immediat du serveur transmis.", 0xd32f2f);
    response.json({ ok: true, message: "Arret immediat transmis au serveur." });
  }));

  api.post("/world/weather", apiAction(async (request, response) => {
    const weather = text(request.body?.weather, 32);
    if (!WEATHER_OPTIONS.includes(weather)) {
      response.status(400).json({ error: "Meteo invalide." });
      return;
    }
    await service.setWeather(weather);
    await audit(client, request, `meteo changee: ${weather}.`);
    response.json({ ok: true, message: `Meteo changee: ${weather}.` });
  }));

  api.post("/world/season", apiAction(async (request, response) => {
    const season = text(request.body?.season, 32);
    if (!SEASON_OPTIONS.includes(season)) {
      response.status(400).json({ error: "Saison invalide." });
      return;
    }
    await service.setSeason(season);
    await audit(client, request, `saison changee: ${season}.`);
    response.json({ ok: true, message: `Saison changee: ${season}.` });
  }));

  api.get("/server/bans", apiAction(async (request, response) => {
    const output = await service.listBans();
    await audit(client, request, "liste des bannis consultee.");
    response.json({ output: sanitizeOutput(output) });
  }));

  api.post("/players/action", apiAction(async (request, response) => {
    const action = text(request.body?.action, 16);
    const identifier = playerIdentifier(request.body?.identifier);
    if (!PLAYER_ACTIONS.includes(action) || !identifier) {
      response.status(400).json({ error: "Action ou survivant invalide." });
      return;
    }
    if (["kick", "ban"].includes(action) && !requireConfirmation(request, response)) return;
    await service.playerAction(action, identifier);
    await audit(client, request, `action ${action} transmise pour un survivant.`, action === "ban" ? 0xd32f2f : 0xf9a825);
    response.json({ ok: true, message: `Action ${action} transmise.` });
  }));

  api.post("/spawn/item", apiAction(async (request, response) => {
    const identifier = playerIdentifier(request.body?.identifier);
    const code = resourceCode(request.body?.code);
    const quantity = integer(request.body?.quantity, 1, 99);
    if (!identifier || !code || !quantity) {
      response.status(400).json({ error: "Survivant, code ou quantite invalide." });
      return;
    }
    await service.spawnItem(identifier, code, quantity);
    await audit(client, request, `objet ${code} x${quantity} envoye a un survivant.`);
    response.json({ ok: true, message: `Objet ${code} x${quantity} envoye.` });
  }));

  api.post("/spawn/backpack", apiAction(async (request, response) => {
    const identifier = playerIdentifier(request.body?.identifier);
    const code = resourceCode(request.body?.code);
    if (!identifier || !code) {
      response.status(400).json({ error: "Survivant ou code invalide." });
      return;
    }
    await service.spawnBackpack(identifier, code);
    await audit(client, request, `sac ${code} envoye a un survivant.`);
    response.json({ ok: true, message: `Sac ${code} envoye.` });
  }));

  api.post("/spawn/vehicle", apiAction(async (request, response) => {
    const identifier = playerIdentifier(request.body?.identifier);
    const code = resourceCode(request.body?.code);
    if (!identifier || !code) {
      response.status(400).json({ error: "Survivant ou code invalide." });
      return;
    }
    await service.spawnVehicle(identifier, code);
    await audit(client, request, `vehicule ${code} envoye a un survivant.`);
    response.json({ ok: true, message: `Vehicule ${code} envoye.` });
  }));

  api.post("/spawn/ai", apiAction(async (request, response) => {
    const identifier = playerIdentifier(request.body?.identifier);
    const type = resourceCode(request.body?.type);
    const quantity = integer(request.body?.quantity, 1, 20);
    const distance = integer(request.body?.distance, 5, 150);
    if (!identifier || !type || !quantity || !distance) {
      response.status(400).json({ error: "Parametres d'IA invalides." });
      return;
    }
    await service.spawnAi(identifier, type, quantity, distance);
    await audit(client, request, `${quantity} IA ${type} envoyee(s) pres d'un survivant.`);
    response.json({ ok: true, message: "IA envoyee." });
  }));

  api.post("/bot/presence", apiAction(async (request, response) => {
    if (!botAvailable(client)) {
      response.status(409).json({ error: "La gestion Discord est disponible seulement sur l'instance Apollo." });
      return;
    }
    const presence = text(request.body?.presence, 100);
    if (!presence) {
      response.status(400).json({ error: "Presence requise (100 caracteres maximum)." });
      return;
    }
    client.user.setPresence({ activities: [{ name: presence, type: ActivityType.Playing }], status: "online" });
    await audit(client, request, "presence de R.A.D.A.R. mise a jour.");
    response.json({ ok: true, message: "Presence du bot mise a jour." });
  }));

  api.post("/bot/sync-commands", apiAction(async (request, response) => {
    if (!botAvailable(client)) {
      response.status(409).json({ error: "La synchronisation Discord est disponible seulement sur l'instance Apollo." });
      return;
    }
    await deployCommands(client.user.id);
    await audit(client, request, "commandes Discord synchronisees.");
    response.json({ ok: true, message: "Commandes Discord synchronisees." });
  }));

  api.post("/rcon/raw", apiAction(async (request, response) => {
    if (!requireConfirmation(request, response, "EXECUTER")) return;
    const command = text(request.body?.command, 250);
    if (!command) {
      response.status(400).json({ error: "Commande RCON requise (250 caracteres maximum)." });
      return;
    }
    const output = await service.execute(command);
    await audit(client, request, "commande RCON avancee executee.", 0xf9a825);
    response.json({ ok: true, output: sanitizeOutput(output) });
  }));

  app.use("/api", api);
  app.use("/assets", dashboardAuth, express.static(publicDirectory, { fallthrough: false }));
  app.get("/", dashboardPageAuth, (request, response) => response.sendFile(path.join(publicDirectory, "index.html")));
  app.use((request, response) => response.status(404).send("Page introuvable."));

  const server = await new Promise((resolve, reject) => {
    const httpServer = app.listen(config.dashboard.port, config.dashboard.host, () => resolve(httpServer));
    httpServer.once("error", reject);
  });
  const location = `http://${config.dashboard.host}:${config.dashboard.port}`;
  console.log(`Panneau R.A.D.A.R. actif: ${location}`);
  return { app, server, location };
}
