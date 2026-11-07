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
      .setName("redemarrage-rapide")
      .setDescription("Programme un redemarrage rapide dans une minute."))
    .addSubcommand((subcommand) => subcommand
      .setName("annuler")
      .setDescription("Annule le redemarrage programme."))
    .addSubcommand((subcommand) => subcommand
      .setName("bannis")
      .setDescription("Affiche la liste RCON des joueurs bannis."))
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
    .addSubcommand((subcommand) => subcommand
      .setName("objet")
      .setDescription("Fait apparaitre un objet pres d'un survivant.")
      .addStringOption((option) => option
        .setName("identifiant")
        .setDescription("Identifiant HumanitZ/Steam du survivant.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(64))
      .addStringOption((option) => option
        .setName("code")
        .setDescription("Code de l'objet HumanitZ.")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(64))
      .addIntegerOption((option) => option
        .setName("quantite")
        .setDescription("Quantite a faire apparaitre.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(99)))
    .addSubcommand((subcommand) => subcommand
      .setName("sac")
      .setDescription("Fait apparaitre un sac pres d'un survivant.")
      .addStringOption((option) => option
        .setName("identifiant")
        .setDescription("Identifiant HumanitZ/Steam du survivant.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(64))
      .addStringOption((option) => option
        .setName("code")
        .setDescription("Code du sac HumanitZ.")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(64)))
    .addSubcommand((subcommand) => subcommand
      .setName("vehicule")
      .setDescription("Fait apparaitre un vehicule pres d'un survivant.")
      .addStringOption((option) => option
        .setName("identifiant")
        .setDescription("Identifiant HumanitZ/Steam du survivant.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(64))
      .addStringOption((option) => option
        .setName("code")
        .setDescription("Code du vehicule HumanitZ.")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(64)))
    .addSubcommand((subcommand) => subcommand
      .setName("ia")
      .setDescription("Fait apparaitre une IA pres d'un survivant.")
      .addStringOption((option) => option
        .setName("identifiant")
        .setDescription("Identifiant HumanitZ/Steam du survivant.")
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(64))
      .addStringOption((option) => option
        .setName("type")
        .setDescription("Code du type d'IA HumanitZ.")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(64))
      .addIntegerOption((option) => option
        .setName("quantite")
        .setDescription("Nombre d'IA a faire apparaitre.")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20))
      .addIntegerOption((option) => option
        .setName("distance")
        .setDescription("Distance d'apparition en metres.")
        .setRequired(true)
        .setMinValue(5)
        .setMaxValue(150)))
].map((command) => command.toJSON());

export async function deployCommands(applicationId) {
  if (!config.discord.guildId) return;

  const rest = new REST({ version: "10" }).setToken(config.discord.token);
  await rest.put(
    Routes.applicationGuildCommands(applicationId, config.discord.guildId),
    { body: commands }
  );
}
