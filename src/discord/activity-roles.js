import {
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder
} from "discord.js";
import { config } from "../config.js";

const PANEL_FOOTER = "RADAR_ACTIVITY_ROLES";
const specialties = [
  { emoji: "🌲", name: "Pisteur", description: "Exploration et routes" },
  { emoji: "📦", name: "Récupérateur", description: "Loot et ressources" },
  { emoji: "🏚️", name: "Fortificateur", description: "Bases et defenses" },
  { emoji: "🛻", name: "Nomade", description: "Vehicules et expeditions" },
  { emoji: "🧟", name: "Nettoyeur", description: "Sorties dangereuses" }
];

function availableSpecialties() {
  return config.humanitz.activityRoleIds
    .map((id, index) => ({ ...specialties[index], id }))
    .filter((role) => role.id && role.name);
}

function panelPayload() {
  const roles = availableSpecialties();
  const menu = new StringSelectMenuBuilder()
    .setCustomId("radar_activity_roles")
    .setPlaceholder("Choisis tes specialites")
    .setMinValues(1)
    .setMaxValues(roles.length)
    .addOptions(
      ...roles.map((role) => ({
        label: role.name,
        value: role.id,
        description: role.description,
        emoji: role.emoji
      })),
      {
        label: "Retirer mes specialites",
        value: "none",
        description: "Retire les roles selectionnables",
        emoji: "✖️"
      }
    );

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x6f8f4e)
        .setTitle("Choisis tes specialites")
        .setDescription("Choisis les roles qui correspondent a ta facon de survivre. Tu peux en prendre plusieurs et les modifier quand tu veux.")
        .addFields(
          { name: "Roles disponibles", value: "🌲 Pisteur  |  📦 Récupérateur  |  🏚️ Fortificateur  |  🛻 Nomade  |  🧟 Nettoyeur" },
          { name: "Vétéran", value: "🔥 Vétéran est attribue par le staff aux survivants fideles." }
        )
        .setFooter({ text: PANEL_FOOTER })
    ],
    components: [new ActionRowBuilder().addComponents(menu)]
  };
}

export async function ensureActivityRolePanel(client) {
  if (!config.humanitz.activityRolesChannelId || !config.humanitz.activityRoleIds.length) return;

  const channel = await client.channels.fetch(config.humanitz.activityRolesChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  const message = recent?.find((candidate) =>
    candidate.author.id === client.user.id
    && candidate.embeds[0]?.footer?.text === PANEL_FOOTER
  );

  if (message) {
    await message.edit(panelPayload());
    return;
  }
  await channel.send(panelPayload());
}

export async function handleActivityRoleInteraction(interaction) {
  if (!interaction.isStringSelectMenu() || interaction.customId !== "radar_activity_roles") return false;

  if (
    interaction.guildId !== config.discord.guildId
    || interaction.channelId !== config.humanitz.activityRolesChannelId
  ) {
    await interaction.reply({ content: "Ce selecteur est reserve au salon HumanitZ.", ephemeral: true });
    return true;
  }

  const selected = interaction.values.includes("none")
    ? []
    : interaction.values.filter((roleId) => config.humanitz.activityRoleIds.includes(roleId));
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const toRemove = config.humanitz.activityRoleIds.filter((roleId) => !selected.includes(roleId));

  if (toRemove.length) await member.roles.remove(toRemove, "Mise a jour des specialites HumanitZ");
  if (selected.length) await member.roles.add(selected, "Mise a jour des specialites HumanitZ");

  const result = selected.length
    ? `Specialites mises a jour: ${selected.map((roleId) => `<@&${roleId}>`).join(", ")}.`
    : "Toutes tes specialites ont ete retirees.";
  await interaction.reply({ content: result, ephemeral: true });
  return true;
}
