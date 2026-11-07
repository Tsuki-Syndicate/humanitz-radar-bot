import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from "discord.js";
import { config } from "../config.js";

const CONNECTION_FOOTER = "RADAR_CONNECTION_PORTAL";
const COMMUNITY_FOOTER = "RADAR_COMMUNITY_PORTAL";

function connectionPayload(index) {
  const statusChannelId = config.humanitz.statusChannelIds[index];
  const address = config.humanitz.publicServerAddress || "Adresse a venir";
  const password = config.humanitz.publicServerPassword || "Aucun mot de passe configure";

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x6f8f4e)
        .setTitle("Rejoindre Quebec Survivors")
        .setDescription("Serveur **[QC/FR] Quebec Survivors - PvE**.")
        .addFields(
          { name: "1. Ouvre HumanitZ", value: "Va dans **Multijoueur**, puis ouvre la liste des serveurs." },
          { name: "2. Cherche le serveur", value: "Recherche `Quebec Survivors`." },
          { name: "Adresse du serveur", value: `\`${address}\``, inline: false },
          { name: "Mot de passe", value: `\`${password}\``, inline: true },
          { name: "Etat en direct", value: statusChannelId ? `Consulte <#${statusChannelId}> avant de partir.` : "Etat disponible prochainement." }
        )
        .setFooter({ text: CONNECTION_FOOTER })
    ]
  };
}

function communityPayload() {
  const inviteUrl = config.humanitz.communityInviteUrl;
  const components = inviteUrl
    ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Rejoindre Quebec Survivors")
        .setStyle(ButtonStyle.Link)
        .setURL(inviteUrl)
    )]
    : [];

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x6f8f4e)
        .setTitle("Discord Quebec Survivors")
        .setDescription("Rejoins le vrai Discord du serveur HumanitZ pour les annonces, les joueurs et les informations du secteur.")
        .setFooter({ text: COMMUNITY_FOOTER })
    ],
    components
  };
}

async function ensureMessage(channel, payload, footer, legacyTitles, client) {
  const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  const message = recent?.find((candidate) =>
    candidate.author.id === client.user.id
    && (
      candidate.embeds[0]?.footer?.text === footer
      || legacyTitles.includes(candidate.embeds[0]?.title)
    )
  );

  if (message) {
    await message.edit(payload);
    return;
  }
  await channel.send(payload);
}

export async function ensureInformationPortals(client) {
  const connectionIds = config.humanitz.connectionChannelIds;
  const connectionTasks = connectionIds.map(async (channelId, index) => {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await ensureMessage(
      channel,
      connectionPayload(index),
      CONNECTION_FOOTER,
      ["Rejoindre Quebec Survivors", "Rejoindre le serveur HumanitZ"],
      client
    );
  });

  const communityTasks = config.humanitz.communityLinkChannelIds.map(async (channelId) => {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await ensureMessage(
      channel,
      communityPayload(),
      COMMUNITY_FOOTER,
      ["Discord Quebec Survivors"],
      client
    );
  });

  const results = await Promise.allSettled([...connectionTasks, ...communityTasks]);
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn(`Synchronisation du portail impossible: ${result.reason.message}`);
    }
  }
}
