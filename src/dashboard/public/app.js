import { aiCatalog, backpackCatalog, itemCatalog, vehicleCatalog } from "./catalog.js";
import { backpackImageSlugs, knownHumanitZImageSlugs } from "./catalog-images.js";

const state = {
  csrf: null,
  players: [],
  catalogs: {
    items: itemCatalog,
    backpacks: backpackCatalog,
    vehicles: vehicleCatalog,
    ai: aiCatalog
  }
};

const $ = (selector) => document.querySelector(selector);
const toastElement = $("#toast");

function showToast(message, error = false) {
  toastElement.textContent = message;
  toastElement.classList.toggle("error", error);
  toastElement.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toastElement.classList.remove("show"), 4200);
}

async function api(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["x-radar-csrf"] = state.csrf;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Le panneau n'a pas pu terminer l'action.");
  return payload;
}

function renderPlayerSelects(players) {
  document.querySelectorAll("[data-player-select]").forEach((select) => {
    const previous = select.value;
    select.replaceChildren();
    const usable = players.filter((player) => player.identifier);
    if (!usable.length) {
      select.add(new Option("Aucun survivant avec identifiant disponible", ""));
      select.disabled = true;
      return;
    }
    select.disabled = false;
    usable.forEach((player) => select.add(new Option(player.name, player.identifier)));
    if (usable.some((player) => player.identifier === previous)) select.value = previous;
  });
}

function catalogLabel(entry) {
  const details = [entry.name, entry.code];
  if (Number.isInteger(entry.slots)) details.push(`${entry.slots} cases`);
  if (entry.maxStack > 1) details.push(`pile max ${entry.maxStack}`);
  if (entry.quantity) details.push(`x${entry.quantity}`);
  return details.join(" - ");
}

function catalogImageUrl(catalogName, entry) {
  if (!["items", "backpacks"].includes(catalogName)) return null;
  const itemSlug = entry.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = catalogName === "backpacks" ? backpackImageSlugs[entry.code] : itemSlug;
  if (!slug || !knownHumanitZImageSlugs.has(slug)) return null;
  return `https://humanitz.codexery.com/images/humanitz/${slug}.webp`;
}

function renderCatalogPreview(name, entry) {
  document.querySelectorAll(`[data-catalog-preview="${name}"]`).forEach((preview) => {
    preview.replaceChildren();
    if (!entry) {
      const empty = document.createElement("span");
      empty.textContent = "Choisis un element pour voir ses details.";
      preview.append(empty);
      return;
    }

    const imageUrl = catalogImageUrl(name, entry);
    if (imageUrl) {
      const image = document.createElement("img");
      image.className = "catalog-image";
      image.src = imageUrl;
      image.alt = entry.name;
      image.loading = "lazy";
      image.addEventListener("error", () => image.remove(), { once: true });
      preview.append(image);
    }

    const content = document.createElement("div");
    content.className = "catalog-copy";
    const nameElement = document.createElement("strong");
    nameElement.textContent = entry.name;
    const details = document.createElement("span");
    const metadata = [`Code: ${entry.code}`, `Quantite par defaut: x${entry.quantity || 1}`];
    if (Number.isInteger(entry.slots)) metadata.push(`Capacite: ${entry.slots} cases`);
    if (entry.slots === null) metadata.push("Capacite: non documentee");
    if (entry.maxStack > 1) metadata.push(`Pile maximale: ${entry.maxStack}`);
    if (entry.weight) metadata.push(`Poids: ${entry.weight}`);
    details.textContent = metadata.join(" | ");
    content.append(nameElement, details);

    if (entry.description) {
      const description = document.createElement("p");
      description.textContent = entry.description;
      content.append(description);
    }
    preview.append(content);
  });
}

function renderCatalog(name, filter = "") {
  const query = filter.trim().toLocaleLowerCase("fr-CA");
  const entries = state.catalogs[name]
    .filter((entry) => !query || `${entry.name} ${entry.code}`.toLocaleLowerCase("fr-CA").includes(query));

  document.querySelectorAll(`[data-catalog-select="${name}"]`).forEach((select) => {
    const previous = select.value;
    select.replaceChildren();
    select.add(new Option(entries.length ? `Choisir (${entries.length})` : "Aucun resultat", ""));
    entries.forEach((entry) => select.add(new Option(catalogLabel(entry), entry.code)));
    if (entries.some((entry) => entry.code === previous)) select.value = previous;
    const selected = entries.find((entry) => entry.code === select.value) || null;
    renderCatalogPreview(name, selected);
  });
}

function initializeCatalogs() {
  Object.keys(state.catalogs).forEach((name) => renderCatalog(name));
  document.querySelectorAll("[data-catalog-search]").forEach((input) => {
    input.addEventListener("input", () => renderCatalog(input.dataset.catalogSearch, input.value));
  });
  document.querySelectorAll("[data-catalog-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const catalog = state.catalogs[select.dataset.catalogSelect];
      const entry = catalog.find((candidate) => candidate.code === select.value) || null;
      renderCatalogPreview(select.dataset.catalogSelect, entry);

      if (select.dataset.catalogSelect === "items") {
        const quantity = select.form?.elements.quantity;
        if (quantity && entry) {
          quantity.max = String(Math.max(1, Math.min(99, entry.maxStack || 1)));
          quantity.value = String(Math.min(Number(quantity.value) || 1, Number(quantity.max)));
        }
      }
    });
  });
}

function playerActionRow(player) {
  const row = document.createElement("div");
  row.className = "player-row";

  const name = document.createElement("span");
  name.className = "player-name";
  name.textContent = player.name;

  const actions = document.createElement("div");
  actions.className = "player-actions";
  const detailsButton = document.createElement("button");
  detailsButton.className = "button secondary";
  detailsButton.type = "button";
  detailsButton.textContent = "Details";
  detailsButton.disabled = !player.identifier;
  detailsButton.addEventListener("click", async () => {
    await runButton(detailsButton, async () => showPlayerDetails(player));
  });
  const select = document.createElement("select");
  [
    ["unstuck", "Debloquer"],
    ["teleport", "Teleporter"],
    ["kick", "Expulser"],
    ["ban", "Bannir"]
  ].forEach(([value, label]) => select.add(new Option(label, value)));

  const button = document.createElement("button");
  button.className = "button secondary";
  button.type = "button";
  button.textContent = "Appliquer";
  button.disabled = !player.identifier;
  button.addEventListener("click", async () => {
    const action = select.value;
    const requiresConfirmation = ["kick", "ban"].includes(action);
    if (requiresConfirmation) {
      const accepted = await confirmAction({
        title: action === "ban" ? "Bannir ce survivant" : "Expulser ce survivant",
        text: `L'action ${action} sera transmise au serveur HumanitZ.`
      });
      if (!accepted) return;
    }
    await runButton(button, async () => {
      const payload = await api("/api/players/action", {
        method: "POST",
        body: { action, identifier: player.identifier, confirmed: requiresConfirmation }
      });
      showToast(payload.message);
    });
  });

  actions.append(detailsButton, select, button);
  row.append(name, actions);
  return row;
}

function detailLabel(key) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function showPlayerDetails(player) {
  const payload = await api(`/api/players/${encodeURIComponent(player.identifier)}/details`);
  $("#player-details-name").textContent = payload.name || player.name;
  $("#player-details-position").textContent = payload.position
    ? `Position: ${Math.round(payload.position.x)}, ${Math.round(payload.position.y)}, ${Math.round(payload.position.z)}`
    : "Position indisponible";
  const list = $("#player-details-list");
  list.replaceChildren();
  const details = Array.isArray(payload.details) ? payload.details : [];
  if (!details.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucune donnee supplementaire disponible.";
    list.append(empty);
  } else {
    details.forEach((detail) => {
      const term = document.createElement("dt");
      term.textContent = detailLabel(detail.key);
      const definition = document.createElement("dd");
      definition.textContent = detail.value;
      list.append(term, definition);
    });
  }
  $("#player-details-dialog").showModal();
}

function renderPlayers(players) {
  const list = $("#player-list");
  list.replaceChildren();
  if (!players.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucun survivant connecte.";
    list.append(empty);
  } else {
    players.forEach((player) => list.append(playerActionRow(player)));
  }
  $("#survivor-count").textContent = String(players.length);
  renderPlayerSelects(players);
}

function setMetric(selector, value) {
  $(selector).textContent = value || "-";
}

async function refreshStatus() {
  const button = $("#refresh-status");
  await runButton(button, async () => {
    try {
      const snapshot = await api("/api/status");
      state.players = snapshot.players;
      $("#online-dot").className = "status-dot online";
      $("#server-state").textContent = "Serveur en ligne";
      $("#server-name").textContent = snapshot.name || "Serveur HumanitZ";
      $("#checked-at").textContent = `Verifie a ${new Date(snapshot.checkedAt).toLocaleTimeString("fr-CA")}`;
      setMetric("#metric-players", String(snapshot.connected));
      setMetric("#metric-latency", `${snapshot.latencyMs} ms`);
      setMetric("#metric-uptime", snapshot.uptime);
      setMetric("#metric-season", snapshot.season);
      setMetric("#metric-weather", snapshot.weather);
      setMetric("#metric-time", snapshot.time);
      renderPlayers(snapshot.players);
    } catch (error) {
      $("#online-dot").className = "status-dot offline";
      $("#server-state").textContent = "Serveur inaccessible";
      $("#checked-at").textContent = "RCON ne repond pas pour le moment";
      showToast(error.message, true);
    }
  }, false);
}

function renderMap(snapshot) {
  const pins = $("#map-pins");
  const empty = $("#map-empty");
  pins.replaceChildren();
  const { xMin, xMax, yMin, yMax } = snapshot.bounds;

  snapshot.players.forEach((player) => {
    const left = ((player.position.y - yMin) / (yMax - yMin)) * 100;
    const top = ((xMax - player.position.x) / (xMax - xMin)) * 100;
    if (left < 0 || left > 100 || top < 0 || top > 100) return;

    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "map-pin";
    pin.dataset.name = player.name;
    pin.title = player.name;
    pin.setAttribute("aria-label", `Position de ${player.name}`);
    pin.style.left = `${left}%`;
    pin.style.top = `${top}%`;
    pins.append(pin);
  });

  empty.classList.toggle("hidden", pins.childElementCount > 0);
}

async function refreshMap() {
  try {
    const snapshot = await api("/api/map");
    renderMap(snapshot);
    const count = snapshot.players.length;
    $("#map-updated").textContent = count
      ? `${count} position(s) - ${new Date(snapshot.checkedAt).toLocaleTimeString("fr-CA")}`
      : "Aucun joueur en ligne";
  } catch (error) {
    $("#map-updated").textContent = "Positions indisponibles";
  }
}

async function loadRestartSchedule() {
  const schedule = await api("/api/server/restart-schedule");
  $("#daily-restart-next").textContent = schedule.enabled && schedule.nextAt
    ? new Date(schedule.nextAt).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: schedule.timeZone })
    : "Desactive";
  $("#daily-restart-warning").textContent = schedule.enabled
    ? `${schedule.warningMinutes} minutes avant ${String(schedule.hour).padStart(2, "0")}:00`
    : "-";
  $("#daily-restart-zone").textContent = schedule.timeZone;
}

async function loadKits() {
  const payload = await api("/api/kits");
  const select = $("#kit-select");
  select.replaceChildren();
  payload.kits.forEach((kit) => select.add(new Option(kit.name, kit.id)));
  const updateDescription = () => {
    const kit = payload.kits.find((candidate) => candidate.id === select.value);
    $("#kit-description").textContent = kit?.description || "Choisis un kit.";
  };
  select.addEventListener("change", updateDescription);
  updateDescription();
}

function historyDate(value) {
  return new Date(value).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });
}

async function refreshHistory() {
  const payload = await api("/api/history?limit=60");
  const list = $("#history-list");
  list.replaceChildren();
  if (!payload.entries?.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucune action enregistree.";
    list.append(empty);
  } else {
    payload.entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = `history-row ${entry.tone || "normal"}`;
      const action = document.createElement("strong");
      action.textContent = entry.action;
      const meta = document.createElement("span");
      meta.textContent = `${entry.actor} - ${historyDate(entry.at)}`;
      row.append(action, meta);
      list.append(row);
    });
  }
  $("#history-updated").textContent = payload.entries?.length ? "60 dernieres actions" : "Aucune action";
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function runButton(button, action, disable = true) {
  const original = button?.textContent;
  if (button && disable) {
    button.disabled = true;
    button.textContent = "En cours...";
  }
  try {
    await action();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    if (button && disable) {
      button.disabled = false;
      button.textContent = original;
    }
  }
}

function confirmAction({ title, text, phrase = null }) {
  const dialog = $("#confirm-dialog");
  const form = $("#confirm-form");
  const phraseRow = $("#confirm-phrase-row");
  const phraseInput = $("#confirm-phrase");
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-phrase-label").textContent = phrase || "";
  phraseRow.classList.toggle("hidden", !phrase);
  phraseInput.value = "";
  phraseInput.required = Boolean(phrase);

  return new Promise((resolve) => {
    let completed = false;
    const finish = (value) => {
      if (completed) return;
      completed = true;
      dialog.close();
      resolve(value);
    };
    $("#confirm-cancel").onclick = () => finish(false);
    dialog.oncancel = (event) => {
      event.preventDefault();
      finish(false);
    };
    form.onsubmit = (event) => {
      event.preventDefault();
      if (phrase && phraseInput.value.trim() !== phrase) {
        showToast(`Ecris exactement ${phrase} pour confirmer.`, true);
        phraseInput.focus();
        return;
      }
      finish(true);
    };
    dialog.showModal();
  });
}

function registerApiForms() {
  document.querySelectorAll("form[data-api]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const confirmTitle = form.dataset.confirmTitle;
      if (confirmTitle) {
        const accepted = await confirmAction({ title: confirmTitle, text: form.dataset.confirmText });
        if (!accepted) return;
      }
      await runButton(button, async () => {
        const body = formData(form);
        if (confirmTitle) body.confirmed = true;
        const payload = await api(form.dataset.api, { method: "POST", body });
        showToast(payload.message || "Action terminee.");
        void refreshHistory();
        if (form.dataset.api.startsWith("/api/world/") || form.dataset.api.includes("restart")) {
          window.setTimeout(refreshStatus, 350);
        }
      });
    });
  });
}

function registerConfirmationButtons() {
  document.querySelectorAll("[data-confirm-api]").forEach((button) => {
    button.addEventListener("click", async () => {
      const phrase = button.dataset.confirmPhrase || null;
      const accepted = await confirmAction({
        title: button.dataset.confirmTitle,
        text: button.dataset.confirmText,
        phrase
      });
      if (!accepted) return;
      await runButton(button, async () => {
        const payload = await api(button.dataset.confirmApi, {
          method: "POST",
          body: { confirmed: true, confirmation: phrase || undefined }
        });
        showToast(payload.message || "Action terminee.");
        void refreshHistory();
      });
    });
  });
}

function registerShutdown() {
  const dialog = $("#shutdown-dialog");
  const form = $("#shutdown-form");
  $("[data-shutdown]").addEventListener("click", () => {
    form.reset();
    dialog.showModal();
  });
  $("#shutdown-cancel").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = formData(form);
    if (values.confirmation !== "ARRETER") {
      showToast("Ecris exactement ARRETER pour confirmer.", true);
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    await runButton(button, async () => {
      const payload = await api("/api/server/shutdown", {
        method: "POST",
        body: { ...values, confirmed: true }
      });
      dialog.close();
      showToast(payload.message);
      void refreshHistory();
    });
  });
}

function registerUtilities() {
  $("#load-bans").addEventListener("click", async () => {
    await runButton($("#load-bans"), async () => {
      const payload = await api("/api/server/bans");
      const output = $("#bans-output");
      output.textContent = payload.output;
      output.classList.remove("hidden");
      void refreshHistory();
    });
  });
  $("#sync-commands").addEventListener("click", async () => {
    await runButton($("#sync-commands"), async () => {
      const payload = await api("/api/bot/sync-commands", { method: "POST", body: {} });
      showToast(payload.message);
    });
  });
  $("#refresh-discord").addEventListener("click", async () => {
    await runButton($("#refresh-discord"), async () => {
      const payload = await api("/api/monitor/refresh", { method: "POST", body: {} });
      showToast(payload.message);
    });
  });
  $("#raw-console").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formData(form);
    if (values.confirmation !== "EXECUTER") {
      showToast("Ecris exactement EXECUTER pour confirmer.", true);
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    await runButton(button, async () => {
      const payload = await api("/api/rcon/raw", { method: "POST", body: { ...values, confirmed: true } });
      const output = $("#raw-output");
      output.textContent = payload.output;
      output.classList.remove("hidden");
      showToast("Commande RCON executee.");
      void refreshHistory();
    });
  });
  $("#logout").addEventListener("click", async () => {
    try {
      await api("/auth/logout", { method: "POST", body: {} });
      window.location.href = "/auth/discord";
    } catch (error) {
      showToast(error.message, true);
    }
  });
}

async function boot() {
  try {
    const session = await api("/api/session");
    state.csrf = session.csrf;
    $("#user-name").textContent = session.user.username;
    if (session.user.avatar) $("#user-avatar").src = session.user.avatar;
    if (session.bot.avatar) $("#bot-avatar").src = session.bot.avatar;
    if (session.localMode) $("#logout").classList.add("hidden");
    if (!session.features.botManagement) {
      $("#bot-mode-message").classList.remove("hidden");
      document.querySelectorAll("#bot input, #bot button").forEach((element) => {
        element.disabled = true;
      });
    }
    initializeCatalogs();
    await loadKits();
    registerApiForms();
    registerConfirmationButtons();
    registerShutdown();
    registerUtilities();
    $("#refresh-status").addEventListener("click", refreshStatus);
    await refreshStatus();
    await refreshMap();
    await loadRestartSchedule();
    await refreshHistory();
    window.setInterval(refreshStatus, 30_000);
    window.setInterval(refreshMap, 20_000);
    window.setInterval(refreshHistory, 30_000);
  } catch (error) {
    showToast(error.message || "Le panneau ne peut pas demarrer.", true);
  }
}

boot();
