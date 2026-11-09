import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { config } from "../config.js";
import { sendAnnouncement, sendLog } from "../discord/logs.js";

const STATE_FILE = join(process.cwd(), ".radar-state", "daily-restart.json");

function clockInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

export function restartActionAt(date, schedule = config.humanitz.dailyRestart) {
  const local = clockInTimeZone(date, schedule.timeZone);
  const nowMinutes = local.hour * 60 + local.minute;
  const restartMinutes = schedule.hour * 60;
  const warningMinutes = (restartMinutes - schedule.warningMinutes + 1_440) % 1_440;

  if (nowMinutes === restartMinutes) return { type: "restart", dateKey: local.dateKey };
  if (nowMinutes === warningMinutes) return { type: "warning", dateKey: local.dateKey };
  return null;
}

export class DailyRestartScheduler {
  constructor(client, service) {
    this.client = client;
    this.service = service;
    this.interval = null;
    this.running = false;
    this.state = { warned: null, restarted: null };
  }

  async start() {
    if (!config.humanitz.rconConfigured || !config.humanitz.dailyRestart.enabled) return;
    this.state = await this.loadState();
    await this.tick();
    this.interval = setInterval(() => void this.tick(), 15_000);
    console.log(
      `Redemarrage quotidien: ${String(config.humanitz.dailyRestart.hour).padStart(2, "0")}:00 ${config.humanitz.dailyRestart.timeZone} (avertissement ${config.humanitz.dailyRestart.warningMinutes} min avant).`
    );
  }

  stop() {
    clearInterval(this.interval);
  }

  async tick(now = new Date()) {
    if (this.running) return;
    const action = restartActionAt(now);
    if (!action) return;

    this.running = true;
    try {
      if (action.type === "warning" && this.state.warned !== action.dateKey) {
        this.state.warned = action.dateKey;
        await this.saveState();
        const message = `Redemarrage automatique dans ${config.humanitz.dailyRestart.warningMinutes} minutes. Mettez-vous a l'abri; votre progression sera sauvegardee.`;
        await this.service.announce(message);
        await sendAnnouncement(this.client, message);
        await sendLog(this.client, "R.A.D.A.R. | Redemarrage planifie", message, 0xf9a825);
        console.log("Redemarrage quotidien: avertissement envoye.");
      }

      if (action.type === "restart" && this.state.restarted !== action.dateKey) {
        this.state.restarted = action.dateKey;
        await this.saveState();
        const message = "Redemarrage automatique en cours. Le serveur sauvegarde puis revient dans quelques instants.";
        await sendAnnouncement(this.client, message);
        await sendLog(this.client, "R.A.D.A.R. | Redemarrage automatique", message, 0xd32f2f);
        await this.service.restartNow();
        console.log("Redemarrage quotidien: demande envoyee au serveur.");
      }
    } catch (error) {
      console.error(`Redemarrage quotidien impossible: ${error.message}`);
    } finally {
      this.running = false;
    }
  }

  async loadState() {
    try {
      const parsed = JSON.parse(await readFile(STATE_FILE, "utf8"));
      return {
        warned: typeof parsed.warned === "string" ? parsed.warned : null,
        restarted: typeof parsed.restarted === "string" ? parsed.restarted : null
      };
    } catch {
      return { warned: null, restarted: null };
    }
  }

  async saveState() {
    await mkdir(dirname(STATE_FILE), { recursive: true });
    const temporary = `${STATE_FILE}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.state)}\n`, "utf8");
    await rename(temporary, STATE_FILE);
  }
}
