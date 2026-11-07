import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "../config.js";

const weatherChoices = [
  ["Clair", "clear"],
  ["Partiellement nuageux", "partly_cloudy"],
  ["Couvert", "overcast"],
  ["Brouillard", "foggy"],
  ["Pluie legere", "light_rain"],
  ["Pluie", "rain"],
  ["Orage", "thunder"],
  ["Neige legere", "light_snow"],
  ["Neige", "snow"],
  ["Blizzard", "blizzard"]
];

const discordAdminCommand = new SlashCommandBuilder()
  .setName("discord")
  .setDescription("Administration complete du serveur Discord, reservee au staff.")
  .addSubcommand((subcommand) => subcommand
    .setName("serveur-renommer")
    .setDescription("Renomme le serveur Discord.")
    .addStringOption((option) => option.setName("nom").setDescription("Nouveau nom.").setRequired(true).setMaxLength(100)))
  .addSubcommand((subcommand) => subcommand
    .setName("salon-creer")
    .setDescription("Cree un salon texte, vocal ou une categorie.")
    .addStringOption((option) => option
      .setName("type")
      .setDescription("Type de salon.")
      .setRequired(true)
      .addChoices(
        { name: "Texte", value: "text" },
        { name: "Vocal", value: "voice" },
        { name: "Categorie", value: "category" }
      ))
    .addStringOption((option) => option.setName("nom").setDescription("Nom du salon.").setRequired(true).setMaxLength(100))
    .addChannelOption((option) => option.setName("categorie").setDescription("Categorie parente, facultative.")))
  .addSubcommand((subcommand) => subcommand
    .setName("salon-renommer")
    .setDescription("Renomme un salon ou une categorie.")
    .addChannelOption((option) => option.setName("salon").setDescription("Salon a modifier.").setRequired(true))
    .addStringOption((option) => option.setName("nom").setDescription("Nouveau nom.").setRequired(true).setMaxLength(100)))
  .addSubcommand((subcommand) => subcommand
    .setName("salon-supprimer")
    .setDescription("Supprime un salon ou une categorie.")
    .addChannelOption((option) => option.setName("salon").setDescription("Salon a supprimer.").setRequired(true))
    .addBooleanOption((option) => option.setName("confirmer").setDescription("Confirmer la suppression.").setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("role-creer")
    .setDescription("Cree un role.")
    .addStringOption((option) => option.setName("nom").setDescription("Nom du role.").setRequired(true).setMaxLength(100))
    .addStringOption((option) => option.setName("couleur").setDescription("Couleur hex, par exemple #5BCE77.")))
  .addSubcommand((subcommand) => subcommand
    .setName("role-renommer")
    .setDescription("Renomme un role.")
    .addRoleOption((option) => option.setName("role").setDescription("Role a modifier.").setRequired(true))
    .addStringOption((option) => option.setName("nom").setDescription("Nouveau nom.").setRequired(true).setMaxLength(100)))
  .addSubcommand((subcommand) => subcommand
    .setName("role-supprimer")
    .setDescription("Supprime un role.")
    .addRoleOption((option) => option.setName("role").setDescription("Role a supprimer.").setRequired(true))
    .addBooleanOption((option) => option.setName("confirmer").setDescription("Confirmer la suppression.").setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("role-donner")
    .setDescription("Ajoute un role a un membre.")
    .addUserOption((option) => option.setName("membre").setDescription("Membre cible.").setRequired(true))
    .addRoleOption((option) => option.setName("role").setDescription("Role a ajouter.").setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("role-retirer")
    .setDescription("Retire un role a un membre.")
    .addUserOption((option) => option.setName("membre").setDescription("Membre cible.").setRequired(true))
    .addRoleOption((option) => option.setName("role").setDescription("Role a retirer.").setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("message")
    .setDescription("Envoie un message au nom de R.A.D.A.R.")
    .addChannelOption((option) => option.setName("salon").setDescription("Salon cible.").setRequired(true))
    .addStringOption((option) => option.setName("texte").setDescription("Message a envoyer.").setRequired(true).setMaxLength(2_000)))
  .addSubcommand((subcommand) => subcommand
    .setName("purge")
    .setDescription("Supprime les messages recents d'un salon.")
    .addChannelOption((option) => option.setName("salon").setDescription("Salon cible.").setRequired(true))
    .addIntegerOption((option) => option.setName("nombre").setDescription("Entre 2 et 100 messages.").setRequired(true).setMinValue(2).setMaxValue(100))
    .addBooleanOption((option) => option.setName("confirmer").setDescription("Confirmer la suppression.").setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName("timeout")
    .setDescription("Coupe temporairement la parole a un membre.")
    .addUserOption((option) => option.setName("membre").setDescription("Membre cible.").setRequired(true))
    .addIntegerOption((option) => option.setName("minutes").setDescription("Entre 1 minute et 7 jours.").setRequired(true).setMinValue(1).setMaxValue(10_080))
    .addStringOption((option) => option.setName("raison").setDescription("Raison, facultative.").setMaxLength(300)))
  .addSubcommand((subcommand) => subcommand
    .setName("expulser")
    .setDescription("Expulse un membre du serveur.")
    .addUserOption((option) => option.setName("membre").setDescription("Membre cible.").setRequired(true))
    .addBooleanOption((option) => option.setName("confirmer").setDescription("Confirmer l'expulsion.").setRequired(true))
    .addStringOption((option) => option.setName("raison").setDescription("Raison, facultative.").setMaxLength(300)))
  .addSubcommand((subcommand) => subcommand
    .setName("bannir")
    .setDescription("Bannit un membre du serveur.")
    .addUserOption((option) => option.setName("membre").setDescription("Membre cible.").setRequired(true))
    .addBooleanOption((option) => option.setName("confirmer").setDescription("Confirmer le bannissement.").setRequired(true))
    .addStringOption((option) => option.setName("raison").setDescription("Raison, facultative.").setMaxLength(300)))
  .addSubcommand((subcommand) => subcommand
    .setName("debannir")
    .setDescription("Retire le bannissement d'un membre par son ID Discord.")
    .addStringOption((option) => option.setName("id").setDescription("ID Discord du membre.").setRequired(true).setMinLength(17).setMaxLength(20)));

const commands = [
  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Affiche les commandes disponibles de R.A.D.A.R."),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Affiche l'etat actuel du serveur HumanitZ."),
  new SlashCommandBuilder()
    .setName("joueurs")
    .setDescription("Affiche les survivants actuellement connectes."),
  new SlashCommandBuilder()
    .setName("alertes")
    .setDescription("Active ou retire les alertes du serveur HumanitZ."),
  discordAdminCommand,
  new SlashCommandBuilder()
    .setName("hz")
    .setDescription("Gestion HumanitZ reservee au staff.")
    .addSubcommand((subcommand) => subcommand
      .setName("statut")
      .setDescription("Force une mise a jour du statut public."))
    .addSubcommand((subcommand) => subcommand
      .setName("annoncer")
      .setDescription("Envoie une annonce dans le jeu et sur Discord.")
      .addStringOption((option) => option
        .setName("message")
        .setDescription("Message a transmettre aux survivants.")
        .setRequired(true)
        .setMaxLength(180)))
    .addSubcommand((subcommand) => subcommand
      .setName("redemarrer")
      .setDescription("Programme un redemarrage du serveur.")
      .addIntegerOption((option) => option
        .setName("minutes")
        .setDescription("Delai avant le redemarrage, de 1 a 120 minutes.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(120)))
    .addSubcommand((subcommand) => subcommand
      .setName("annuler")
      .setDescription("Annule le redemarrage programme."))
    .addSubcommand((subcommand) => subcommand
      .setName("meteo")
      .setDescription("Change la meteo du serveur.")
      .addStringOption((option) => option
        .setName("type")
        .setDescription("Meteo souhaitee.")
        .setRequired(true)
        .addChoices(...weatherChoices.map(([name, value]) => ({ name, value })))))
    .addSubcommand((subcommand) => subcommand
      .setName("saison")
      .setDescription("Change la saison du serveur.")
      .addStringOption((option) => option
        .setName("type")
        .setDescription("Saison souhaitee.")
        .setRequired(true)
        .addChoices(
          { name: "Printemps", value: "spring" },
          { name: "Ete", value: "summer" },
          { name: "Automne", value: "autumn" },
          { name: "Hiver", value: "winter" }
        )))
    .addSubcommand((subcommand) => subcommand
      .setName("joueur")
      .setDescription("Intervient sur un joueur avec son identifiant HumanitZ/Steam.")
      .addStringOption((option) => option
        .setName("action")
        .setDescription("Action a executer.")
        .setRequired(true)
        .addChoices(
          { name: "Expulser", value: "kick" },
          { name: "Bannir", value: "ban" },
          { name: "Debannir", value: "unban" },
          { name: "Debloquer", value: "unstuck" },
          { name: "Teleporter au spawn", value: "teleport" }
        ))
      .addStringOption((option) => option
        .setName("identifiant")
        .setDescription("Identifiant HumanitZ/Steam du joueur.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(64)))
].map((command) => command.toJSON());

export async function deployCommands(applicationId) {
  if (!config.discord.guildId) return;

  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  await rest.put(
    Routes.applicationGuildCommands(applicationId, config.discord.guildId),
    { body: commands }
  );
}
