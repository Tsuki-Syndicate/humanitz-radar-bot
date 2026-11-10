import { config } from "../config.js";
import { HumanitZRcon } from "./rcon.js";

function valueAfter(lines, expression) {
  return lines.map((line) => line.match(expression)).find(Boolean)?.[1]?.trim() || null;
}

function playerName(line) {
  // RCON returns extra private data after the player name (Steam ID, level and clan).
  return line.split(/\s*(?:\(|\bLv:|\bClan:|\bDPassed:)/i)[0]?.trim() || "Survivant inconnu";
}

function playerRecord(line) {
  const identifier = line.match(/\(([^)]+)\)/)?.[1]?.trim()
    || line.match(/\b\d{15,20}_\+_\|[A-Za-z0-9_-]{8,}\b/)?.[0]
    || null;

  return {
    name: playerName(line),
    identifier
  };
}

function playerFields(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => {
        const separator = line.indexOf("=");
        return separator > 0
          ? [line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()]
          : null;
      })
      .filter(Boolean)
  );
}

function playerData(output) {
  const fields = playerFields(output);
  const match = fields.pos?.match(
    /X\s*=\s*(-?\d+(?:\.\d+)?)\s+Y\s*=\s*(-?\d+(?:\.\d+)?)\s+Z\s*=\s*(-?\d+(?:\.\d+)?)/i
  );

  return {
    name: fields.name || null,
    position: match
      ? { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }
      : null
  };
}

export function parsePlayerDetails(output) {
  const parsed = playerData(output);
  const hidden = /steam|net.?id|inventory|clan|password|token/i;
  const details = Object.entries(playerFields(output))
    .filter(([key, value]) => key !== "name" && key !== "pos" && !hidden.test(key) && value && value.length <= 160)
    .slice(0, 24)
    .map(([key, value]) => ({ key, value }));
  return { ...parsed, details };
}

export function parseServerInfo(info, playersOutput) {
  const lines = info.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const playerRecords = playersOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^no players connected$/i.test(line))
    .map(playerRecord);

  return {
    raw: info,
    name: valueAfter(lines, /^Name:\s*(.+?)\s*\(Uptime:/i) || "Serveur HumanitZ",
    uptime: valueAfter(lines, /\(Uptime:\s*([^)]*)\)/i),
    connected: Number(valueAfter(lines, /^(\d+)\s+connected\.?$/i)) || 0,
    season: valueAfter(lines, /^Season:\s*(.+)$/i),
    weather: valueAfter(lines, /^Weather:\s*(.+)$/i),
    time: valueAfter(lines, /^Time:\s*(.+)$/i),
    ai: valueAfter(lines, /^AI:\s*(.+)$/i),
    players: playerRecords.map((player) => player.name),
    // Kept for private staff controls only; never render identifiers in public Discord cards.
    playerRecords
  };
}

export class HumanitZService {
  constructor() {
    this.mapSnapshot = null;
    this.mapSnapshotAt = 0;
    this.mapSnapshotRequest = null;
  }

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

  async getMapSnapshot() {
    const now = Date.now();
    if (this.mapSnapshot && now - this.mapSnapshotAt < 10_000) return this.mapSnapshot;
    if (this.mapSnapshotRequest) return this.mapSnapshotRequest;
    if (!config.humanitz.rconConfigured) {
      throw new Error("RCON HumanitZ n'est pas configure.");
    }

    this.mapSnapshotRequest = (async () => {
      const rcon = this.createConnection();
      try {
        await rcon.connect();
        const playersOutput = await rcon.command("Players");
        const records = playersOutput
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !/^no players connected$/i.test(line))
          .map(playerRecord);
        const players = [];

        for (const record of records) {
          if (!record.identifier) {
            players.push({ name: record.name, position: null });
            continue;
          }
          const details = playerData(await rcon.command(`fetchplayerdata ${record.identifier}`));
          players.push({ name: details.name || record.name, position: details.position });
        }

        const snapshot = { checkedAt: new Date().toISOString(), players };
        this.mapSnapshot = snapshot;
        this.mapSnapshotAt = Date.now();
        return snapshot;
      } finally {
        rcon.disconnect();
      }
    })();

    try {
      return await this.mapSnapshotRequest;
    } finally {
      this.mapSnapshotRequest = null;
    }
  }

  async getPlayerDetails(identifier) {
    return parsePlayerDetails(await this.execute(`fetchplayerdata ${identifier}`));
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

  restartNow() {
    return this.execute("RestartNow");
  }

  shutdown() {
    return this.execute("shutdown");
  }

  save() {
    return this.execute("save");
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

  async giveKit(netId, kit) {
    const commands = [
      ...(kit.backpack ? [`spawnbackpack ${netId} ${kit.backpack}`] : []),
      ...kit.items.map((item) => `spawnitem ${netId} ${item.code} ${item.quantity}`)
    ];
    if (!commands.length) throw new Error("Kit HumanitZ vide.");

    const rcon = this.createConnection();
    try {
      await rcon.connect();
      for (const command of commands) await rcon.command(command);
    } finally {
      rcon.disconnect();
    }
  }
}
