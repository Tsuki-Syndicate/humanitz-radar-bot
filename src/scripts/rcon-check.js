import "dotenv/config";
import { HumanitZRcon } from "../humanitz/rcon.js";

const rcon = new HumanitZRcon({
  host: process.env.HUMANITZ_RCON_HOST,
  port: Number(process.env.HUMANITZ_RCON_PORT),
  password: process.env.HUMANITZ_RCON_PASSWORD
});

try {
  await rcon.connect();
  console.log("Authentification RCON validee.");
  const info = await rcon.command("info");
  console.log(info || "Connexion RCON validee; le serveur n'a retourne aucun detail.");
} catch (error) {
  console.error(`Verification RCON echouee: ${error.message}`);
  process.exitCode = 1;
} finally {
  rcon.disconnect();
}
