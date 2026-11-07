import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { actionEmbed, statusEmbed } from "./embeds.js";
import { sendAnnouncement, sendLog } from "./logs.js";
import { handleDiscordAdminCommand } from "./admin.js";

function memberHasRole(member, roleId) {
  if (!roleId || !member) return false;
  if (Array.isArray(member.roles)) return member.roles.includes(roleId);
  return member.roles?.cache?.has(roleId) || false;
}

function isStaff(interaction) {
  return interaction.guild?.ownerId === interaction.user.id
    || memberHasRole(interaction.member, config.humanitz.staffRoleId);
}

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5bce77)
    .setTitle("R.A.D.A.R. | Assistance")
    .setDescription("Relais d'alerte et de defense des rescapes.")
    .addFields(
      { name: "Public", value: "`/status` - etat du serveur\n`/joueurs` - survivants connectes", inline: false },
      { name: "Staff", value: "`/hz statut` `annonce` `redemarrer` `annuler` `meteo` `saison` `joueur`", inline: false }
    )
    .setFooter({ text: "Les commandes staff sont reservees au proprietaire et au role configure." });
}

function playersEmbed(snapshot) {
  const players = snapshot.players.length ? snapshot.players.join("\n") : "Aucun survivant connecte";
  return new EmbedBuilder()
    .setColor(0x5bce77)
    .setTitle("R.A.D.A.R. | Survivants")
    .setDescription(`**${snapshot.name}**\n\n${players.slice(0, 3_800)}`)
    .setFooter({ text: `${snapshot.connected} connecte(s)` })
    .setTimestamp();
}

function safeIdentifier(value) {
  return /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

export function createInteractionHandler({ client, service, monitor }) {
  return async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "aide") {
      await interaction.reply({ embeds: [helpEmbed()], ephemeral: true });
      return;
    }

    if (interaction.commandName === "status" || interaction.commandName === "joueurs") {
      if (
        config.humanitz.commandsChannelId
        && interaction.channelId !== config.humanitz.commandsChannelId
      ) {
        await interaction.reply({
          content: `Utilise ces commandes dans <#${config.humanitz.commandsChannelId}>.`,
          ephemeral: true
        });
        return;
      }

      await interaction.deferReply();
      try {
        const snapshot = await service.getStatus();
        const embed = interaction.commandName === "status"
          ? statusEmbed(snapshot)
          : playersEmbed(snapshot);
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error("Lecture HumanitZ impossible:", error.message);
        await interaction.editReply("Le relais R.A.D.A.R. ne peut pas joindre le serveur HumanitZ pour le moment.");
      }
      return;
    }

    if (interaction.commandName === "discord") {
      if (!isStaff(interaction)) {
        await interaction.reply({ content: "Acces refuse: commande reservee au staff.", ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        await handleDiscordAdminCommand(interaction, client);
      } catch (error) {
        console.error("Commande Discord impossible:", error.message);
        await interaction.editReply(`Action non executee: ${error.message}`);
      }
      return;
    }

    if (interaction.commandName !== "hz") return;
    if (!isStaff(interaction)) {
      await interaction.reply({ content: "Acces refuse: commande reservee au staff.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand();

    try {
      let confirmation;
      if (subcommand === "statut") {
        await monitor.tick();
        confirmation = "Mise a jour du statut demandee.";
      }

      if (subcommand === "annoncer") {
        const message = interaction.options.getString("message", true);
        await service.announce(message);
        await sendAnnouncement(client, message);
        confirmation = "Annonce transmise au serveur HumanitZ.";
      }

      if (subcommand === "redemarrer") {
        const minutes = interaction.options.getInteger("minutes", true);
        await service.restart(minutes);
        confirmation = `Redemarrage programme dans ${minutes} minute(s).`;
      }

      if (subcommand === "annuler") {
        await service.cancelRestart();
        confirmation = "Redemarrage programme annule.";
      }

      if (subcommand === "meteo") {
        const weather = interaction.options.getString("type", true);
        await service.setWeather(weather);
        confirmation = `Meteo changee: ${weather}.`;
      }

      if (subcommand === "saison") {
        const season = interaction.options.getString("type", true);
        await service.setSeason(season);
        confirmation = `Saison changee: ${season}.`;
      }

      if (subcommand === "joueur") {
        const action = interaction.options.getString("action", true);
        const identifier = interaction.options.getString("identifiant", true);
        if (!safeIdentifier(identifier)) throw new Error("Identifiant joueur invalide.");
        await service.playerAction(action, identifier);
        confirmation = `Action ${action} transmise pour ${identifier}.`;
      }

      await interaction.editReply({ embeds: [actionEmbed("R.A.D.A.R. | Ordre execute", confirmation)] });
      await sendLog(
        client,
        "R.A.D.A.R. | Action staff",
        `**${interaction.user.tag}**: ${confirmation}`,
        0x5bce77
      );
    } catch (error) {
      console.error("Commande staff HumanitZ impossible:", error.message);
      await interaction.editReply("Ordre non execute. Verifie la connexion RCON et les informations saisies.");
      await sendLog(
        client,
        "R.A.D.A.R. | Echec action staff",
        `**${interaction.user.tag}**: ${subcommand} a echoue.`,
        0xd32f2f
      );
    }
  };
}
