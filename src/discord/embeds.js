import { EmbedBuilder } from "discord.js";

function value(value, fallback = "Inconnu") {
  return value || fallback;
}

const seasons = {
  spring: "Printemps",
  summer: "Ete",
  autumn: "Automne",
  fall: "Automne",
  winter: "Hiver"
};

const weather = {
  clear: "Degage",
  cloudy: "Nuageux",
  overcast: "Couvert",
  rain: "Pluie",
  rainy: "Pluie",
  storm: "Orage",
  stormy: "Orage",
  fog: "Brouillard",
  foggy: "Brouillard",
  snow: "Neige",
  snowy: "Neige"
};

function humanize(value, dictionary) {
  if (!value) return "Inconnu";
  return dictionary[value.toLowerCase()] || value;
}

function safeText(text) {
  return String(text || "").replace(/[\\`*_~>|]/g, "\\$&");
}

function activityValue(ai) {
  if (!ai) return "Donnees AI indisponibles";

  const count = (label) => ai.match(new RegExp(`${label}\\s*[=:]\\s*(\\d+)`, "i"))?.[1];
  const zombies = count("zombies?");
  const humans = count("humans?");
  const animals = count("animals?");

  if (!zombies && !humans && !animals) return safeText(ai).slice(0, 1_000);

  return [
    zombies && `Zombies: **${zombies}**`,
    humans && `Humains: **${humans}**`,
    animals && `Animaux: **${animals}**`
  ].filter(Boolean).join("  |  ");
}

function playersValue(players) {
  if (!players.length) return "Aucun survivant dans le secteur.";

  const shown = players
    .slice(0, 15)
    .map((player) => `- ${safeText(player)}`)
    .join("\n");
  const overflow = players.length > 15 ? `\n+ ${players.length - 15} autre(s) survivant(s)` : "";
  return `${shown}${overflow}`.slice(0, 1_000);
}

function latencyValue(latencyMs) {
  if (!Number.isFinite(latencyMs)) return "Mesure en cours";
  return `${latencyMs} ms`;
}

export function statusEmbed(snapshot, { online = true } = {}) {
  if (!online) {
    return new EmbedBuilder()
      .setColor(0xd32f2f)
      .setTitle("R.A.D.A.R. // 🔴 SIGNAL PERDU")
      .setDescription("Le relais ne recoit plus de reponse du serveur HumanitZ. La surveillance continue automatiquement.")
      .addFields(
        { name: "Etat", value: "🔴 **HORS LIGNE**", inline: true },
        { name: "Prochaine action", value: "Nouvelle tentative automatique", inline: true },
        { name: "Information", value: "Le serveur peut etre en redemarrage ou la liaison RCON peut etre indisponible.", inline: false }
      )
      .setFooter({ text: "RADAR_STATUS | Surveillance automatique active" })
      .setTimestamp();
  }

  const connected = Number.isFinite(snapshot.connected) ? snapshot.connected : snapshot.players.length;

  return new EmbedBuilder()
    .setColor(0x6f8f4e)
    .setTitle("R.A.D.A.R. // 🟢 SECTEUR EN LIGNE")
    .setDescription(`**${safeText(value(snapshot.name, "Serveur HumanitZ"))}**\n> Liaison RCON stable. Le secteur est sous surveillance.`)
    .addFields(
      { name: "RELAIS", value: `🟢 **EN LIGNE**\nRCON: \`${latencyValue(snapshot.latencyMs)}\``, inline: true },
      { name: "POPULATION", value: `**${connected}** connecte(s)`, inline: true },
      { name: "HEURE LOCALE", value: `\`${value(snapshot.time)}\``, inline: true },
      { name: "MONDE", value: `${humanize(snapshot.season, seasons)}  |  ${humanize(snapshot.weather, weather)}`, inline: false },
      { name: "ACTIVITE LOCALE", value: activityValue(snapshot.ai), inline: false },
      { name: "SURVIVANTS CONNECTES", value: playersValue(snapshot.players), inline: false }
    )
    .setFooter({ text: `RADAR_STATUS | Uptime: ${value(snapshot.uptime)} | Scan automatique` })
    .setTimestamp(snapshot.checkedAt || new Date());
}

export function actionEmbed(title, description, color = 0x4caf50) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}
