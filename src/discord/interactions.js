import { EmbedBuilder } from "discord.js";
import { config } from "../config.js";
import { bansEmbed, handleControlInteraction } from "./control-interactions.js";
import { actionEmbed, statusEmbed } from "./embeds.js";
import { sendAnnouncement, sendLog } from "./logs.js";

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
      { name: "Public", value: "`/status` - etat du serveur\n`/joueurs` - survivants connectes\n`/alertes` - active ou retire les alertes", inline: false },
      { name: "Staff", value: "`/hz statut` `annonce` `redemarrer` `redemarrage-rapide` `annuler` `bannis` `meteo` `saison` `joueur` `objet` `sac` `vehicule` `ia`", inline: false }
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

function safeResourceCode(value) {
  return /^[a-zA-Z0-9_.-]{1,64}$/.test(value);
}

export function createInteractionHandler({ client, service, monitor }) {
  return async (interaction) => {
    if (await handleControlInteraction(interaction, { client, service, monitor, isStaff })) return;
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
        const startedAt = Date.now();
        const snapshot = await service.getStatus();
        snapshot.latencyMs = Date.now() - startedAt;
        snapshot.checkedAt = new Date();
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

    if (interaction.commandName === "alertes") {
      if (!config.humanitz.alertRoleId) {
        await interaction.reply({ content: "Les alertes serveur ne sont pas encore configurees.", ephemeral: true });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (member.roles.cache.has(config.humanitz.alertRoleId)) {
        await member.roles.remove(config.humanitz.alertRoleId, "Desinscription volontaire aux alertes");
        await interaction.reply({ content: "Tu ne recevras plus les alertes serveur.", ephemeral: true });
      } else {
        await member.roles.add(config.humanitz.alertRoleId, "Inscription volontaire aux alertes");
        await interaction.reply({ content: "Alertes serveur activees.", ephemeral: true });
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
        const message = `Redemarrage du serveur dans ${minutes} minute(s). Mettez-vous en securite.`;
        await service.announce(message);
        await sendAnnouncement(client, message);
        confirmation = `Redemarrage programme dans ${minutes} minute(s).`;
      }

      if (subcommand === "redemarrage-rapide") {
        await service.quickRestart();
        const message = "Redemarrage rapide du serveur dans une minute. Mettez-vous en securite.";
        await service.announce(message);
        await sendAnnouncement(client, message);
        confirmation = "Redemarrage rapide programme dans une minute.";
      }

      if (subcommand === "annuler") {
        await service.cancelRestart();
        const message = "Le redemarrage programme est annule.";
        await service.announce(message);
        await sendAnnouncement(client, message);
        confirmation = "Redemarrage programme annule.";
      }

      if (subcommand === "bannis") {
        const bans = await service.listBans();
        confirmation = "Liste RCON des bannis consultee.";
        await interaction.editReply({ embeds: [bansEmbed(bans)] });
        await sendLog(
          client,
          "R.A.D.A.R. | Action staff",
          `**${interaction.user.tag}**: ${confirmation}`,
          0x5bce77
        );
        return;
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

      if (subcommand === "objet") {
        const identifier = interaction.options.getString("identifiant", true);
        const code = interaction.options.getString("code", true);
        const quantity = interaction.options.getInteger("quantite", true);
        if (!safeIdentifier(identifier) || !safeResourceCode(code)) throw new Error("Identifiant ou code invalide.");
        await service.spawnItem(identifier, code, quantity);
        confirmation = `Objet ${code} x${quantity} envoye pres de ${identifier}.`;
      }

      if (subcommand === "sac") {
        const identifier = interaction.options.getString("identifiant", true);
        const code = interaction.options.getString("code", true);
        if (!safeIdentifier(identifier) || !safeResourceCode(code)) throw new Error("Identifiant ou code invalide.");
        await service.spawnBackpack(identifier, code);
        confirmation = `Sac ${code} envoye pres de ${identifier}.`;
      }

      if (subcommand === "vehicule") {
        const identifier = interaction.options.getString("identifiant", true);
        const code = interaction.options.getString("code", true);
        if (!safeIdentifier(identifier) || !safeResourceCode(code)) throw new Error("Identifiant ou code invalide.");
        await service.spawnVehicle(identifier, code);
        confirmation = `Vehicule ${code} envoye pres de ${identifier}.`;
      }

      if (subcommand === "ia") {
        const identifier = interaction.options.getString("identifiant", true);
        const type = interaction.options.getString("type", true);
        const quantity = interaction.options.getInteger("quantite", true);
        const distance = interaction.options.getInteger("distance", true);
        if (!safeIdentifier(identifier) || !safeResourceCode(type)) throw new Error("Identifiant ou code invalide.");
        await service.spawnAi(identifier, type, quantity, distance);
        confirmation = `${quantity} IA ${type} envoyee(s) a ${distance} m de ${identifier}.`;
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
