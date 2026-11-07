import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from "discord.js";
import { config } from "../config.js";

const PANEL_FOOTER = "RADAR_CONTROL_PANEL";

export function controlPanelPayload() {
  const primaryActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("radar_control:status")
      .setLabel("Actualiser le statut")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("radar_control:announcement")
      .setLabel("Annonce en jeu")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("radar_control:bans")
      .setLabel("Liste des bannis")
      .setStyle(ButtonStyle.Secondary)
  );

  const managementActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("radar_control:player")
      .setLabel("Joueur")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("radar_control:assistance")
      .setLabel("Assistance")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("radar_control:world")
      .setLabel("Monde")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("radar_control:restart")
      .setLabel("Redemarrer 1 min")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("radar_control:cancel_restart")
      .setLabel("Annuler redemarrage")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x6f8f4e)
        .setTitle("R.A.D.A.R. // CENTRE DE CONTROLE")
        .setDescription("Panneau prive de gestion du serveur HumanitZ.")
        .addFields(
          { name: "RELAIS", value: "Statut, annonces, bannissements et redemarrages.", inline: false },
          { name: "TERRAIN", value: "Interventions joueur, assistance et reglages du monde.", inline: false }
        )
        .setFooter({ text: PANEL_FOOTER })
        .setTimestamp()
    ],
    components: [primaryActions, managementActions]
  };
}

export async function ensureControlPanel(client) {
  if (!config.humanitz.controlChannelId) return;

  const channel = await client.channels.fetch(config.humanitz.controlChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const recent = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const existing = recent?.find((message) =>
    message.author.id === client.user.id
    && message.embeds[0]?.footer?.text === PANEL_FOOTER
  );

  if (existing) {
    await existing.edit(controlPanelPayload());
    return;
  }

  await channel.send(controlPanelPayload());
}
