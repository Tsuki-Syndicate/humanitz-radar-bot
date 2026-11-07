import { config } from "../config.js";
import { HumanitZRcon } from "./rcon.js";

export async function readServerStatus() {
  const rcon = new HumanitZRcon({
    host: config.humanitz.rconHost,
    port: config.humanitz.rconPort,
    password: config.humanitz.rconPassword
  });

  try {
    await rcon.connect();
    const info = await rcon.command("info");
    return info || "Le serveur est joignable, mais n'a retourne aucun detail.";
  } finally {
    rcon.disconnect();
  }
}
