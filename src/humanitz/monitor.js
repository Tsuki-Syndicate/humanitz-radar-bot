import { config } from "../config.js";
import { statusEmbed } from "../discord/embeds.js";
import { sendLog } from "../discord/logs.js";

export class HumanitZMonitor {
  constructor(client, service) {
    this.client = client;
    this.service = service;
    this.interval = null;
    this.statusMessageId = null;
    this.lastOnline = null;
    this.lastPlayers = new Set();
    this.running = false;
  }

  start() {
    if (!config.humanitz.rconConfigured) return;
    void this.tick();
    this.interval = setInterval(() => void this.tick(), config.humanitz.statusIntervalSeconds * 1_000);
  }

  stop() {
    clearInterval(this.interval);
  }

  async tick() {
    if (this.running) return;
    this.running = true;

    try {
      const snapshot = await this.service.getStatus();
      await this.publishStatus(statusEmbed(snapshot));
      await this.logChanges(snapshot);
      this.lastOnline = true;
    } catch (error) {
      console.warn(`Surveillance HumanitZ: ${error.message}`);
      await this.publishStatus(statusEmbed(null, { online: false }));
      if (this.lastOnline === true) {
        await sendLog(this.client, "R.A.D.A.R. | Serveur indisponible", "La surveillance RCON ne recoit plus de reponse.", 0xd32f2f);
      }
      this.lastOnline = false;
    } finally {
      this.running = false;
    }
  }

  async publishStatus(embed) {
    if (!config.humanitz.statusChannelId) return;

    const channel = await this.client.channels.fetch(config.humanitz.statusChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    let message = this.statusMessageId
      ? await channel.messages.fetch(this.statusMessageId).catch(() => null)
      : null;

    if (!message) {
      const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
      message = recent?.find((candidate) =>
        candidate.author.id === this.client.user.id
        && candidate.embeds[0]?.footer?.text?.startsWith("RADAR_STATUS")
      );
    }

    if (message) {
      this.statusMessageId = message.id;
      await message.edit({ embeds: [embed] });
      return;
    }

    const created = await channel.send({ embeds: [embed] });
    this.statusMessageId = created.id;
  }

  async logChanges(snapshot) {
    const currentPlayers = new Set(snapshot.players);
    if (this.lastOnline === null) {
      this.lastPlayers = currentPlayers;
      return;
    }

    if (this.lastOnline === false) {
      await sendLog(this.client, "R.A.D.A.R. | Serveur de retour", "La connexion RCON est de nouveau operationnelle.", 0x5bce77);
    }

    const joined = [...currentPlayers].filter((player) => !this.lastPlayers.has(player));
    const left = [...this.lastPlayers].filter((player) => !currentPlayers.has(player));

    if (joined.length) {
      await sendLog(this.client, "R.A.D.A.R. | Survivant arrive", joined.join("\n"), 0x5bce77);
    }
    if (left.length) {
      await sendLog(this.client, "R.A.D.A.R. | Survivant parti", left.join("\n"), 0xffa726);
    }

    this.lastPlayers = currentPlayers;
  }
}
