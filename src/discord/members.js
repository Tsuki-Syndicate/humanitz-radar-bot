import { Events } from "discord.js";
import { config } from "../config.js";
import { sendLog } from "./logs.js";

export function registerMemberEvents(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.guild.id !== config.discord.guildId || !config.humanitz.memberRoleId) return;

    try {
      await member.roles.add(config.humanitz.memberRoleId, "Nouveau survivant Quebec Survivors");
      await sendLog(client, "R.A.D.A.R. | Nouveau survivant", `<@${member.id}> a rejoint le secteur.`, 0x5bce77);
    } catch (error) {
      console.error("Role Survivant impossible a ajouter:", error.message);
    }
  });
}
