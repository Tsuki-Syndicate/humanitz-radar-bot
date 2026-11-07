import { config } from "../config.js";
import { HumanitZRcon } from "./rcon.js";

function valueAfter(lines, expression) {
  return lines.map((line) => line.match(expression)).find(Boolean)?.[1]?.trim() || null;
}

function playerName(line) {
  // RCON returns extra private data after the player name (Steam ID, level and clan).
  return line.match(/^(.+?)\s*\(/)?.[1]?.trim() || line;
}

export function parseServerInfo(info, playersOutput) {
  const lines = info.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const players = playersOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^no players connected$/i.test(line))
    .map(playerName);

  return {
    raw: info,
    name: valueAfter(lines, /^Name:\s*(.+?)\s*\(Uptime:/i) || "Serveur HumanitZ",
    uptime: valueAfter(lines, /\(Uptime:\s*([^)]*)\)/i),
    connected: Number(valueAfter(lines, /^(\d+)\s+connected\.?$/i)) || 0,
    season: valueAfter(lines, /^Season:\s*(.+)$/i),
    weather: valueAfter(lines, /^Weather:\s*(.+)$/i),
    time: valueAfter(lines, /^Time:\s*(.+)$/i),
    ai: valueAfter(lines, /^AI:\s*(.+)$/i),
    players
  };
}

export class HumanitZService {
  createConnection() {
    return new HumanitZRcon({
      host: config.humanitz.rconHost,
      port: config.humanitz.rconPort,
      password: config.humanitz.rconPassword
    });
  }

  async execute(command) {
    if (!config.humanitz.rconConfigured) {
      throw new Error("RCON HumanitZ n'est pas configure.");
    }

    const rcon = this.createConnection();
    try {
      await rcon.connect();
      return await rcon.command(command);
    } finally {
      rcon.disconnect();
    }
  }

  async getStatus() {
    if (!config.humanitz.rconConfigured) {
      throw new Error("RCON HumanitZ n'est pas configure.");
    }

    const rcon = this.createConnection();
    try {
      await rcon.connect();
      const [info, players] = await Promise.all([
        rcon.command("info"),
        rcon.command("Players")
      ]);
      return parseServerInfo(info, players);
    } finally {
      rcon.disconnect();
    }
  }

  announce(message) {
    return this.execute(`admin message ${message}`);
  }

  restart(minutes) {
    return this.execute(`restart ${minutes}`);
  }

  quickRestart() {
    return this.execute("QuickRestart");
  }

  cancelRestart() {
    return this.execute("CancelRestart");
  }

  listBans() {
    return this.execute("fetchbanned");
  }

  setWeather(weather) {
    return this.execute(`weather ${weather}`);
  }

  setSeason(season) {
    return this.execute(`season ${season}`);
  }

  playerAction(action, netId) {
    const commands = {
      kick: `kick ${netId}`,
      ban: `ban ${netId}`,
      unban: `unban ${netId}`,
      unstuck: `unstuck ${netId}`,
      teleport: `teleport ${netId}`
    };
    if (!commands[action]) throw new Error("Action joueur invalide.");
    return this.execute(commands[action]);
  }

  spawnItem(netId, itemId, quantity) {
    return this.execute(`spawnitem ${netId} ${itemId} ${quantity}`);
  }

  spawnBackpack(netId, backpackId) {
    return this.execute(`spawnbackpack ${netId} ${backpackId}`);
  }

  spawnVehicle(netId, vehicleId) {
    return this.execute(`spawncar ${netId} ${vehicleId}`);
  }

  spawnAi(netId, aiType, quantity, distance) {
    return this.execute(`spawnai ${netId} ${aiType} ${quantity} ${distance}`);
  }
}
