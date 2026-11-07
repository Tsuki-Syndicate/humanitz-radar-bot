import { ChannelType } from "discord.js";
import { actionEmbed } from "./embeds.js";
import { sendLog } from "./logs.js";

function mustConfirm(interaction) {
  if (!interaction.options.getBoolean("confirmer", true)) {
    throw new Error("Action annulee: confirmation manquante.");
  }
}

function parseColor(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error("Couleur invalide. Utilise un code comme #5BCE77.");
  }
  return Number.parseInt(normalized, 16);
}

function ensureRoleManageable(guild, role) {
  const botMember = guild.members.me;
  if (role.id === guild.id || role.managed || botMember?.roles.highest.comparePositionTo(role) <= 0) {
    throw new Error("Ce role ne peut pas etre gere par R.A.D.A.R.");
  }
}

async function memberFromOption(interaction) {
  const user = interaction.options.getUser("membre", true);
  return interaction.guild.members.fetch(user.id);
}

function ensureMemberManageable(member, action) {
  if (!member.moderatable && action === "timeout") {
    throw new Error("Ce membre ne peut pas etre mute par R.A.D.A.R.");
  }
  if (!member.kickable && action === "kick") {
    throw new Error("Ce membre ne peut pas etre expulse par R.A.D.A.R.");
  }
  if (!member.bannable && action === "ban") {
    throw new Error("Ce membre ne peut pas etre banni par R.A.D.A.R.");
  }
}

function channelType(value) {
  return {
    text: ChannelType.GuildText,
    voice: ChannelType.GuildVoice,
    category: ChannelType.GuildCategory
  }[value];
}

async function record(client, interaction, description, color = 0x5bce77) {
  await sendLog(client, "R.A.D.A.R. | Action Discord", `**${interaction.user.tag}**: ${description}`, color);
}

export async function handleDiscordAdminCommand(interaction, client) {
  const guild = interaction.guild;
  const subcommand = interaction.options.getSubcommand();
  let confirmation;

  if (subcommand === "serveur-renommer") {
    const name = interaction.options.getString("nom", true);
    await guild.edit({ name, reason: `R.A.D.A.R. par ${interaction.user.tag}` });
    confirmation = `Serveur renomme: **${name}**.`;
  }

  if (subcommand === "salon-creer") {
    const type = interaction.options.getString("type", true);
    const name = interaction.options.getString("nom", true);
    const parent = interaction.options.getChannel("categorie");
    if (parent && parent.type !== ChannelType.GuildCategory) {
      throw new Error("La categorie selectionnee n'est pas une categorie Discord.");
    }
    const channel = await guild.channels.create({
      name,
      type: channelType(type),
      parent: parent?.id,
      reason: `R.A.D.A.R. par ${interaction.user.tag}`
    });
    confirmation = `Salon cree: <#${channel.id}>.`;
  }

  if (subcommand === "salon-renommer") {
    const channel = interaction.options.getChannel("salon", true);
    const name = interaction.options.getString("nom", true);
    await channel.setName(name, `R.A.D.A.R. par ${interaction.user.tag}`);
    confirmation = `Salon renomme: **${name}**.`;
  }

  if (subcommand === "salon-supprimer") {
    mustConfirm(interaction);
    const channel = interaction.options.getChannel("salon", true);
    const channelName = channel.name;
    await channel.delete(`R.A.D.A.R. par ${interaction.user.tag}`);
    confirmation = `Salon supprime: **${channelName}**.`;
  }

  if (subcommand === "role-creer") {
    const name = interaction.options.getString("nom", true);
    const color = parseColor(interaction.options.getString("couleur"));
    const role = await guild.roles.create({
      name,
      colors: color === null ? undefined : { primaryColor: color },
      reason: `R.A.D.A.R. par ${interaction.user.tag}`
    });
    confirmation = `Role cree: <@&${role.id}>.`;
  }

  if (subcommand === "role-renommer") {
    const role = interaction.options.getRole("role", true);
    const name = interaction.options.getString("nom", true);
    ensureRoleManageable(guild, role);
    await role.setName(name, `R.A.D.A.R. par ${interaction.user.tag}`);
    confirmation = `Role renomme: **${name}**.`;
  }

  if (subcommand === "role-supprimer") {
    mustConfirm(interaction);
    const role = interaction.options.getRole("role", true);
    const roleName = role.name;
    ensureRoleManageable(guild, role);
    await role.delete(`R.A.D.A.R. par ${interaction.user.tag}`);
    confirmation = `Role supprime: **${roleName}**.`;
  }

  if (subcommand === "role-donner" || subcommand === "role-retirer") {
    const member = await memberFromOption(interaction);
    const role = interaction.options.getRole("role", true);
    ensureRoleManageable(guild, role);
    if (subcommand === "role-donner") {
      await member.roles.add(role, `R.A.D.A.R. par ${interaction.user.tag}`);
      confirmation = `Role <@&${role.id}> ajoute a <@${member.id}>.`;
    } else {
      await member.roles.remove(role, `R.A.D.A.R. par ${interaction.user.tag}`);
      confirmation = `Role <@&${role.id}> retire de <@${member.id}>.`;
    }
  }

  if (subcommand === "message") {
    const channel = interaction.options.getChannel("salon", true);
    const content = interaction.options.getString("texte", true);
    if (!channel.isTextBased()) throw new Error("Ce salon ne peut pas recevoir de message.");
    await channel.send({ content, allowedMentions: { parse: [] } });
    confirmation = `Message envoye dans <#${channel.id}>.`;
  }

  if (subcommand === "purge") {
    mustConfirm(interaction);
    const channel = interaction.options.getChannel("salon", true);
    const amount = interaction.options.getInteger("nombre", true);
    if (!channel.isTextBased() || typeof channel.bulkDelete !== "function") {
      throw new Error("Ce salon ne permet pas la suppression groupee.");
    }
    const deleted = await channel.bulkDelete(amount, true);
    confirmation = `${deleted.size} message(s) recent(s) supprime(s) dans <#${channel.id}>.`;
  }

  if (subcommand === "timeout") {
    const member = await memberFromOption(interaction);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("raison") || `R.A.D.A.R. par ${interaction.user.tag}`;
    ensureMemberManageable(member, "timeout");
    await member.timeout(minutes * 60_000, reason);
    confirmation = `<@${member.id}> est timeout pour ${minutes} minute(s).`;
  }

  if (subcommand === "expulser" || subcommand === "bannir") {
    mustConfirm(interaction);
    const member = await memberFromOption(interaction);
    const reason = interaction.options.getString("raison") || `R.A.D.A.R. par ${interaction.user.tag}`;
    const action = subcommand === "expulser" ? "kick" : "ban";
    ensureMemberManageable(member, action);
    if (action === "kick") {
      await member.kick(reason);
      confirmation = `<@${member.id}> a ete expulse.`;
    } else {
      await member.ban({ reason });
      confirmation = `<@${member.id}> a ete banni.`;
    }
  }

  if (subcommand === "debannir") {
    const userId = interaction.options.getString("id", true);
    if (!/^\d{17,20}$/.test(userId)) throw new Error("ID Discord invalide.");
    await guild.bans.remove(userId, `R.A.D.A.R. par ${interaction.user.tag}`);
    confirmation = `Le bannissement de ${userId} a ete retire.`;
  }

  await interaction.editReply({ embeds: [actionEmbed("R.A.D.A.R. | Action Discord executee", confirmation)] });
  await record(client, interaction, confirmation);
}
