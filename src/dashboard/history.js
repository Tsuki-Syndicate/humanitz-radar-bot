import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const HISTORY_FILE = join(process.cwd(), ".radar-state", "dashboard-history.json");
const MAX_ENTRIES = 250;

export class DashboardHistory {
  constructor() {
    this.entries = [];
    this.writeQueue = Promise.resolve();
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(HISTORY_FILE, "utf8"));
      this.entries = Array.isArray(parsed)
        ? parsed.filter((entry) => entry && typeof entry.action === "string").slice(0, MAX_ENTRIES)
        : [];
    } catch {
      this.entries = [];
    }
  }

  list(limit = 60) {
    return this.entries.slice(0, Math.max(1, Math.min(100, limit)));
  }

  async add({ actor, action, tone = "normal" }) {
    const entry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      actor: String(actor || "Administrateur").slice(0, 80),
      action: String(action || "Action du panneau").slice(0, 240),
      tone: ["normal", "warning", "danger"].includes(tone) ? tone : "normal"
    };
    this.entries.unshift(entry);
    this.entries = this.entries.slice(0, MAX_ENTRIES);
    this.writeQueue = this.writeQueue.then(() => this.persist(), () => this.persist());
    await this.writeQueue;
    return entry;
  }

  async persist() {
    await mkdir(dirname(HISTORY_FILE), { recursive: true });
    const temporary = `${HISTORY_FILE}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.entries)}\n`, "utf8");
    await rename(temporary, HISTORY_FILE);
  }
}
