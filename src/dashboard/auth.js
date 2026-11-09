import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

const SESSION_COOKIE = "radar_session";
const OAUTH_STATE_COOKIE = "radar_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decode(value) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function sign(value) {
  return createHmac("sha256", config.dashboard.sessionSecret).update(value).digest("base64url");
}

function signedValue(payload) {
  const value = encode(payload);
  return `${value}.${sign(value)}`;
}

function verifiedValue(value) {
  if (!config.dashboard.sessionSecret || !value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const valid = Buffer.byteLength(signature) === Buffer.byteLength(expected)
    && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;
  return decode(payload);
}

function cookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s))
      .filter(([name]) => name)
      .map(([name, value]) => [name, decodeURIComponent(value || "")])
  );
}

function secureCookie() {
  return config.dashboard.publicUrl?.startsWith("https://") ? "; Secure" : "";
}

function setCookie(response, name, value, maxAgeSeconds) {
  response.append(
    "Set-Cookie",
    `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureCookie()}`
  );
}

function clearCookie(response, name) {
  response.append(
    "Set-Cookie",
    `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie()}`
  );
}

function loopback(request) {
  const address = request.socket.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function configuredError(response) {
  response.status(503).send("Le panneau n'est pas encore configure pour une connexion Discord.");
}

async function authorizedDiscordUser(client, user) {
  const guild = config.discord.guildId
    ? await client.guilds.fetch(config.discord.guildId).catch(() => null)
    : null;
  if (!guild) return false;
  if (guild.ownerId === user.id || config.dashboard.adminUserIds.includes(user.id)) return true;
  if (!config.humanitz.staffRoleId) return false;

  const member = await guild.members.fetch(user.id).catch(() => null);
  return Boolean(member?.roles.cache.has(config.humanitz.staffRoleId));
}

export function dashboardAuth(request, response, next) {
  if (config.dashboard.devBypass) {
    if (!loopback(request)) {
      response.status(403).send("Le mode local n'accepte que les connexions depuis cette machine.");
      return;
    }
    request.dashboardUser = {
      id: "local",
      username: "Administrateur local",
      csrf: "radar-local-only"
    };
    next();
    return;
  }

  const session = verifiedValue(cookies(request)[SESSION_COOKIE]);
  if (!session || session.expiresAt <= Date.now()) {
    response.status(401).json({ error: "Connexion requise." });
    return;
  }
  request.dashboardUser = session;
  next();
}

export function dashboardPageAuth(request, response, next) {
  if (config.dashboard.devBypass) {
    if (!loopback(request)) {
      response.status(403).send("Le mode local n'accepte que les connexions depuis cette machine.");
      return;
    }
    request.dashboardUser = {
      id: "local",
      username: "Administrateur local",
      csrf: "radar-local-only"
    };
    next();
    return;
  }

  const session = verifiedValue(cookies(request)[SESSION_COOKIE]);
  if (!session || session.expiresAt <= Date.now()) {
    response.redirect("/auth/discord");
    return;
  }
  request.dashboardUser = session;
  next();
}

export function dashboardCsrf(request, response, next) {
  if (request.method === "GET" || request.method === "HEAD") {
    next();
    return;
  }
  if (request.get("x-radar-csrf") !== request.dashboardUser?.csrf) {
    response.status(403).json({ error: "Verification de securite invalide. Recharge le panneau." });
    return;
  }
  next();
}

export function mountDashboardAuth(app, client) {
  app.get("/auth/discord", (request, response) => {
    if (config.dashboard.devBypass) {
      response.redirect("/");
      return;
    }
    if (!config.dashboard.oauthConfigured) {
      configuredError(response);
      return;
    }

    const state = randomBytes(24).toString("base64url");
    setCookie(response, OAUTH_STATE_COOKIE, signedValue({ state, expiresAt: Date.now() + 10 * 60 * 1000 }), 600);
    const query = new URLSearchParams({
      client_id: config.dashboard.oauthClientId,
      redirect_uri: `${config.dashboard.publicUrl}/auth/discord/callback`,
      response_type: "code",
      scope: "identify",
      state
    });
    response.redirect(`https://discord.com/oauth2/authorize?${query}`);
  });

  app.get("/auth/discord/callback", async (request, response) => {
    if (config.dashboard.devBypass) {
      response.redirect("/");
      return;
    }
    if (!config.dashboard.oauthConfigured) {
      configuredError(response);
      return;
    }

    const stateCookie = verifiedValue(cookies(request)[OAUTH_STATE_COOKIE]);
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const state = typeof request.query.state === "string" ? request.query.state : "";
    if (!code || !stateCookie || stateCookie.expiresAt <= Date.now() || state !== stateCookie.state) {
      response.status(400).send("Connexion Discord invalide ou expiree.");
      return;
    }

    try {
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.dashboard.oauthClientId,
          client_secret: config.dashboard.oauthClientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: `${config.dashboard.publicUrl}/auth/discord/callback`
        })
      });
      if (!tokenResponse.ok) throw new Error("Echange OAuth refuse");
      const token = await tokenResponse.json();
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });
      if (!userResponse.ok) throw new Error("Profil Discord inaccessible");
      const user = await userResponse.json();

      if (!await authorizedDiscordUser(client, user)) {
        response.status(403).send("Ce compte Discord n'a pas l'autorisation d'utiliser le panneau.");
        return;
      }

      const session = {
        id: user.id,
        username: user.global_name || user.username || "Administrateur",
        avatar: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
          : null,
        csrf: randomBytes(24).toString("base64url"),
        expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
      };
      setCookie(response, SESSION_COOKIE, signedValue(session), SESSION_MAX_AGE_SECONDS);
      clearCookie(response, OAUTH_STATE_COOKIE);
      response.redirect("/");
    } catch (error) {
      console.error("Connexion OAuth du panneau impossible:", error.message);
      response.status(502).send("Connexion Discord impossible. Reessaie dans un instant.");
    }
  });

  app.post("/auth/logout", dashboardAuth, dashboardCsrf, (request, response) => {
    clearCookie(response, SESSION_COOKIE);
    response.status(204).end();
  });
}
