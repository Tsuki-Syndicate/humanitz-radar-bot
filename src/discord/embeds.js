import { EmbedBuilder } from "discord.js";

function value(value, fallback = "Inconnu") {
  return value || fallback;
}

export function statusEmbed(snapshot, { online = true } = {}) {
  if (!online) {
    return new EmbedBuilder()
      .setColor(0xd32f2f)
      .setTitle("R.A.D.A.R. | Relais indisponible")
      .setDescription("Le bot ne peut pas joindre le serveur HumanitZ actuellement.")
      .setFooter({ text: "RADAR_STATUS" })
      .setTimestamp();
  }

  const playerList = snapshot.players.length
    ? snapshot.players.slice(0, 12).join("\n")
    : "Aucun survivant connecte";

  return new EmbedBuilder()
    .setColor(0x5bce77)
    .setTitle("R.A.D.A.R. | Etat du secteur")
    .setDescription(`**${value(snapshot.name)}**`)
    .addFields(
      { name: "Survivants", value: `${snapshot.connected} connecte(s)`, inline: true },
      { name: "Cycle", value: `${value(snapshot.season)} | ${value(snapshot.weather)}`, inline: true },
      { name: "Heure", value: value(snapshot.time), inline: true },
      { name: "Activite", value: value(snapshot.ai), inline: false },
      { name: "Joueurs", value: playerList.slice(0, 1_000), inline: false }
    )
    .setFooter({ text: `RADAR_STATUS | Uptime: ${value(snapshot.uptime)}` })
    .setTimestamp();
}

export function actionEmbed(title, description, color = 0x4caf50) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}
