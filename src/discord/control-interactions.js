import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
import { config } from "../config.js";
import { sendAnnouncement, sendLog } from "./logs.js";

const PREFIX = "radar_control:";

function safeIdentifier(value) {
  return /^[a-zA-Z0-9_-]{3,64}$/.test(value);
}

function safeResourceCode(value) {
  return /^[a-zA-Z0-9_.-]{1,64}$/.test(value);
}

function numberInRange(value, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
}

function input(customId, label, options = {}) {
  const field = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(options.style || TextInputStyle.Short)
    .setRequired(true);

  if (options.placeholder) field.setPlaceholder(options.placeholder);
  if (options.minLength) field.setMinLength(options.minLength);
  if (options.maxLength) field.setMaxLength(options.maxLength);
  return field;
}

function modal(customId, title, fields) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(...fields.map((field) => new ActionRowBuilder().addComponents(field)));
}

function playerMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}player_action`)
      .setPlaceholder("Choisir une intervention joueur")
      .addOptions(
        { label: "Expulser", value: "kick" },
        { label: "Bannir", value: "ban" },
        { label: "Debannir", value: "unban" },
        { label: "Debloquer", value: "unstuck" },
        { label: "Teleporter au spawn", value: "teleport" }
      )
  );
}

function assistanceMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}assistance_type`)
      .setPlaceholder("Choisir une assistance")
      .addOptions(
        { label: "Objet", value: "object" },
        { label: "Sac", value: "backpack" },
        { label: "Vehicule", value: "vehicle" },
        { label: "IA", value: "ai" }
      )
  );
}

function worldMenus() {
  const weather = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}weather`)
      .setPlaceholder("Changer la meteo")
      .addOptions(
        { label: "Clair", value: "clear" },
        { label: "Partiellement nuageux", value: "partly_cloudy" },
        { label: "Couvert", value: "overcast" },
        { label: "Brouillard", value: "foggy" },
        { label: "Pluie legere", value: "light_rain" },
        { label: "Pluie", value: "rain" },
        { label: "Orage", value: "thunder" },
        { label: "Neige", value: "snow" },
        { label: "Blizzard", value: "blizzard" }
      )
  );
  const season = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}season`)
      .setPlaceholder("Changer la saison")
      .addOptions(
        { label: "Printemps", value: "spring" },
        { label: "Ete", value: "summer" },
        { label: "Automne", value: "autumn" },
        { label: "Hiver", value: "winter" }
      )
  );
  return [weather, season];
}

function confirmRestartRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}confirm_restart`)
      .setLabel("Confirmer le redemarrage")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${PREFIX}cancel_confirmation`)
      .setLabel("Retour")
      .setStyle(ButtonStyle.Secondary)
  );
}

function assistanceModal(type) {
  const identity = input("identifiant", "Identifiant HumanitZ ou Steam", {
    placeholder: "Identifiant du survivant",
    minLength: 3,
    maxLength: 64
  });

  if (type === "object") {
    return modal(`${PREFIX}assist:object`, "Assistance - objet", [
      identity,
      input("code", "Code de l'objet", { placeholder: "Code HumanitZ", maxLength: 64 }),
      input("quantite", "Quantite (1 a 99)", { placeholder: "1", maxLength: 2 })
    ]);
  }

  if (type === "backpack") {
    return modal(`${PREFIX}assist:backpack`, "Assistance - sac", [
      identity,
      input("code", "Code du sac", { placeholder: "Code HumanitZ", maxLength: 64 })
    ]);
  }

  if (type === "vehicle") {
    return modal(`${PREFIX}assist:vehicle`, "Assistance - vehicule", [
      identity,
      input("code", "Code du vehicule", { placeholder: "Code HumanitZ", maxLength: 64 })
    ]);
  }

  return modal(`${PREFIX}assist:ai`, "Assistance - IA", [
    identity,
    input("code", "Code du type d'IA", { placeholder: "Code HumanitZ", maxLength: 64 }),
    input("quantite", "Quantite (1 a 20)", { placeholder: "1", maxLength: 2 }),
    input("distance", "Distance en metres (5 a 150)", { placeholder: "25", maxLength: 3 })
  ]);
}

function playerModal(action) {
  const labels = {
    kick: "Expulser un survivant",
    ban: "Bannir un survivant",
    unban: "Debannir un survivant",
    unstuck: "Debloquer un survivant",
    teleport: "Teleporter un survivant"
  };
  return modal(`${PREFIX}player:${action}`, labels[action], [
    input("identifiant", "Identifiant HumanitZ ou Steam", {
      placeholder: "Identifiant du survivant",
      minLength: 3,
      maxLength: 64
    })
  ]);
}

function announcementModal() {
  return modal(`${PREFIX}announcement_modal`, "Annonce HumanitZ", [
    input("message", "Message a envoyer", {
      style: TextInputStyle.Paragraph,
      placeholder: "Message visible en jeu et dans Discord",
      minLength: 1,
      maxLength: 180
    })
  ]);
}

export function bansEmbed(output) {
  const bans = output.trim();
  const content = bans && !/^empty!?$/i.test(bans)
    ? bans.replace(/`/g, "").slice(0, 3_800)
    : "Aucun joueur banni par RCON.";

  return new EmbedBuilder()
    .setColor(0xf9a825)
    .setTitle("R.A.D.A.R. | Liste des bannis")
    .setDescription(content)
    .setTimestamp();
}

async function logAction(client, user, description, color = 0x5bce77) {
  await sendLog(client, "R.A.D.A.R. | Action staff", `**${user.tag}**: ${description}`, color);
}

async function announceRestart(client, service, message) {
  await service.announce(message);
  await sendAnnouncement(client, message);
}

async function allowControl(interaction, isStaff) {
  if (!config.humanitz.controlChannelId || interaction.channelId !== config.humanitz.controlChannelId) {
    await interaction.reply({ content: "Ce panneau doit etre utilise dans le centre de controle prive.", ephemeral: true });
    return false;
  }
  if (!isStaff(interaction)) {
    await interaction.reply({ content: "Acces refuse: panneau reserve au staff.", ephemeral: true });
    return false;
  }
  return true;
}

async function handleButton(interaction, context) {
  const { client, service, monitor } = context;
  const action = interaction.customId.slice(PREFIX.length);

  if (action === "announcement") {
    await interaction.showModal(announcementModal());
    return;
  }
  if (action === "player") {
    await interaction.reply({ content: "Choisis l'intervention a effectuer.", components: [playerMenu()], ephemeral: true });
    return;
  }
  if (action === "assistance") {
    await interaction.reply({ content: "Choisis l'assistance a envoyer.", components: [assistanceMenu()], ephemeral: true });
    return;
  }
  if (action === "world") {
    await interaction.reply({ content: "Choisis la meteo ou la saison.", components: worldMenus(), ephemeral: true });
    return;
  }
  if (action === "restart") {
    await interaction.reply({
      content: "Le redemarrage rapide sera lance dans une minute. Confirmer ?",
      components: [confirmRestartRow()],
      ephemeral: true
    });
    return;
  }
  if (action === "cancel_confirmation") {
    await interaction.update({ content: "Action annulee.", components: [] });
    return;
  }
  if (action === "confirm_restart") {
    await interaction.deferUpdate();
    await service.quickRestart();
    const message = "Redemarrage rapide du serveur dans une minute. Mettez-vous en securite.";
    await announceRestart(client, service, message);
    await interaction.editReply({ content: "Redemarrage rapide programme dans une minute.", components: [] });
    await logAction(client, interaction.user, "Redemarrage rapide programme dans une minute.");
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  if (action === "status") {
    await monitor.tick();
    await interaction.editReply("Tableau du secteur actualise.");
    await logAction(client, interaction.user, "Mise a jour manuelle du statut.");
    return;
  }
  if (action === "bans") {
    const bans = await service.listBans();
    await interaction.editReply({ embeds: [bansEmbed(bans)] });
    await logAction(client, interaction.user, "Consultation de la liste des bannis.");
    return;
  }
  if (action === "cancel_restart") {
    await service.cancelRestart();
    const message = "Le redemarrage programme est annule.";
    await announceRestart(client, service, message);
    await interaction.editReply("Redemarrage programme annule.");
    await logAction(client, interaction.user, "Redemarrage programme annule.");
    return;
  }
}

async function handleSelect(interaction, context) {
  const { client, service } = context;
  const action = interaction.customId.slice(PREFIX.length);
  const value = interaction.values[0];

  if (action === "player_action") {
    await interaction.showModal(playerModal(value));
    return;
  }
  if (action === "assistance_type") {
    await interaction.showModal(assistanceModal(value));
    return;
  }

  await interaction.deferUpdate();
  if (action === "weather") {
    await service.setWeather(value);
    await interaction.editReply({ content: `Meteo changee: ${value}.`, components: [] });
    await logAction(client, interaction.user, `Meteo changee: ${value}.`);
    return;
  }
  if (action === "season") {
    await service.setSeason(value);
    await interaction.editReply({ content: `Saison changee: ${value}.`, components: [] });
    await logAction(client, interaction.user, `Saison changee: ${value}.`);
  }
}

async function handleModal(interaction, context) {
  const { client, service } = context;
  const action = interaction.customId.slice(PREFIX.length);
  await interaction.deferReply({ ephemeral: true });

  if (action === "announcement_modal") {
    const message = interaction.fields.getTextInputValue("message").trim();
    await service.announce(message);
    await sendAnnouncement(client, message);
    await interaction.editReply("Annonce envoyee dans le jeu et Discord.");
    await logAction(client, interaction.user, "Annonce envoyee dans le jeu et Discord.");
    return;
  }

  if (action.startsWith("player:")) {
    const playerAction = action.slice("player:".length);
    const identifier = interaction.fields.getTextInputValue("identifiant").trim();
    if (!safeIdentifier(identifier)) throw new Error("Identifiant joueur invalide.");
    await service.playerAction(playerAction, identifier);
    const confirmation = `Action ${playerAction} transmise pour ${identifier}.`;
    await interaction.editReply(confirmation);
    await logAction(client, interaction.user, confirmation);
    return;
  }

  const assistanceType = action.slice("assist:".length);
  const identifier = interaction.fields.getTextInputValue("identifiant").trim();
  const code = interaction.fields.getTextInputValue("code").trim();
  if (!safeIdentifier(identifier) || !safeResourceCode(code)) throw new Error("Identifiant ou code invalide.");

  let confirmation;
  if (assistanceType === "object") {
    const quantity = numberInRange(interaction.fields.getTextInputValue("quantite").trim(), 1, 99);
    if (!quantity) throw new Error("Quantite invalide.");
    await service.spawnItem(identifier, code, quantity);
    confirmation = `Objet ${code} x${quantity} envoye pres de ${identifier}.`;
  } else if (assistanceType === "backpack") {
    await service.spawnBackpack(identifier, code);
    confirmation = `Sac ${code} envoye pres de ${identifier}.`;
  } else if (assistanceType === "vehicle") {
    await service.spawnVehicle(identifier, code);
    confirmation = `Vehicule ${code} envoye pres de ${identifier}.`;
  } else if (assistanceType === "ai") {
    const quantity = numberInRange(interaction.fields.getTextInputValue("quantite").trim(), 1, 20);
    const distance = numberInRange(interaction.fields.getTextInputValue("distance").trim(), 5, 150);
    if (!quantity || !distance) throw new Error("Quantite ou distance invalide.");
    await service.spawnAi(identifier, code, quantity, distance);
    confirmation = `${quantity} IA ${code} envoyee(s) a ${distance} m de ${identifier}.`;
  } else {
    throw new Error("Assistance invalide.");
  }

  await interaction.editReply(confirmation);
  await logAction(client, interaction.user, confirmation);
}

export async function handleControlInteraction(interaction, context) {
  const isComponent = interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit();
  if (!isComponent || !interaction.customId?.startsWith(PREFIX)) return false;

  if (!await allowControl(interaction, context.isStaff)) return true;

  try {
    if (interaction.isButton()) await handleButton(interaction, context);
    if (interaction.isStringSelectMenu()) await handleSelect(interaction, context);
    if (interaction.isModalSubmit()) await handleModal(interaction, context);
  } catch (error) {
    console.error("Panneau R.A.D.A.R. impossible:", error.message);
    const payload = { content: "Action non executee. Verifie les informations et la connexion RCON.", components: [] };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => null);
    } else {
      await interaction.reply({ ...payload, ephemeral: true }).catch(() => null);
    }
    await sendLog(
      context.client,
      "R.A.D.A.R. | Echec action staff",
      `**${interaction.user.tag}**: action du panneau echouee.`,
      0xd32f2f
    );
  }

  return true;
}
