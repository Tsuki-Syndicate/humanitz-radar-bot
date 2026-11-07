import { config } from "../config.js";
import { actionEmbed } from "./embeds.js";

export async function sendLog(client, title, description, color) {
  if (!config.humanitz.logsChannelId) return;

  const channel = await client.channels.fetch(config.humanitz.logsChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [actionEmbed(title, description, color)] }).catch(() => null);
}

export async function sendAnnouncement(client, message) {
  if (!config.humanitz.announcementsChannelId) return;

  const channel = await client.channels.fetch(config.humanitz.announcementsChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  await channel.send({ embeds: [actionEmbed("R.A.D.A.R. | Transmission", message, 0xf9a825)] }).catch(() => null);
}
