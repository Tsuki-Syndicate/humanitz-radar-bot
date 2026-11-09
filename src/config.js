import "dotenv/config";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuration manquante: ${name}`);
  return value;
}

function identifiers(value) {
  return [...new Set(
    (value || "")
      .split(",")
      .map((identifier) => identifier.trim())
      .filter(Boolean)
  )];
}

function port(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535 ? parsed : fallback;
}

function decimal(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hour(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallback;
}

export const config = {
  discord: {
    token: required("DISCORD_TOKEN"),
    guildId: process.env.DISCORD_GUILD_ID?.trim() || null
  },
  humanitz: {
    rconHost: process.env.HUMANITZ_RCON_HOST?.trim() || null,
    rconPort: Number(process.env.HUMANITZ_RCON_PORT) || null,
    rconPassword: process.env.HUMANITZ_RCON_PASSWORD?.trim() || null,
    statusChannelId: process.env.HUMANITZ_STATUS_CHANNEL_ID?.trim() || null,
    statusMirrorChannelIds: identifiers(process.env.HUMANITZ_STATUS_MIRROR_CHANNEL_IDS),
    connectionChannelIds: identifiers(process.env.HUMANITZ_CONNECTION_CHANNEL_IDS),
    communityLinkChannelIds: identifiers(process.env.HUMANITZ_COMMUNITY_LINK_CHANNEL_IDS),
    activityRoleIds: identifiers(process.env.HUMANITZ_ACTIVITY_ROLE_IDS),
    activityRolesChannelId: process.env.HUMANITZ_ACTIVITY_ROLES_CHANNEL_ID?.trim() || null,
    mapBounds: {
      xMin: decimal(process.env.HUMANITZ_MAP_X_MIN, 3250),
      xMax: decimal(process.env.HUMANITZ_MAP_X_MAX, 399150),
      yMin: decimal(process.env.HUMANITZ_MAP_Y_MIN, -398550),
      yMax: decimal(process.env.HUMANITZ_MAP_Y_MAX, -2650)
    },
    publicServerAddress: process.env.HUMANITZ_PUBLIC_SERVER_ADDRESS?.trim() || null,
    publicServerPassword: process.env.HUMANITZ_PUBLIC_SERVER_PASSWORD?.trim() || null,
    communityInviteUrl: process.env.HUMANITZ_COMMUNITY_INVITE_URL?.trim() || null,
    logsChannelId: process.env.HUMANITZ_LOGS_CHANNEL_ID?.trim() || null,
    announcementsChannelId: process.env.HUMANITZ_ANNOUNCEMENTS_CHANNEL_ID?.trim() || null,
    commandsChannelId: process.env.HUMANITZ_COMMANDS_CHANNEL_ID?.trim() || null,
    controlChannelId: process.env.HUMANITZ_CONTROL_CHANNEL_ID?.trim() || null,
    staffRoleId: process.env.HUMANITZ_STAFF_ROLE_ID?.trim() || null,
    memberRoleId: process.env.HUMANITZ_MEMBER_ROLE_ID?.trim() || null,
    alertRoleId: process.env.HUMANITZ_ALERT_ROLE_ID?.trim() || null,
    statusIntervalSeconds: Math.max(
      30,
      Number(process.env.HUMANITZ_STATUS_INTERVAL_SECONDS) || 60
    ),
    dailyRestart: {
      enabled: process.env.HUMANITZ_DAILY_RESTART_ENABLED !== "0",
      hour: hour(process.env.HUMANITZ_DAILY_RESTART_HOUR, 3),
      warningMinutes: Math.max(1, Math.min(120, Number(process.env.HUMANITZ_DAILY_RESTART_WARNING_MINUTES) || 15)),
      timeZone: process.env.HUMANITZ_DAILY_RESTART_TIMEZONE?.trim() || "America/Toronto"
    },
    get rconConfigured() {
      return Boolean(this.rconHost && this.rconPort && this.rconPassword);
    },
    get statusChannelIds() {
      return [...new Set([this.statusChannelId, ...this.statusMirrorChannelIds].filter(Boolean))];
    }
  },
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED === "1",
    host: process.env.DASHBOARD_HOST?.trim() || "127.0.0.1",
    port: port(process.env.DASHBOARD_PORT, 8790),
    devBypass: process.env.DASHBOARD_DEV_BYPASS === "1",
    publicUrl: process.env.DASHBOARD_PUBLIC_URL?.trim().replace(/\/$/, "") || null,
    oauthClientId: process.env.DASHBOARD_OAUTH_CLIENT_ID?.trim() || null,
    oauthClientSecret: process.env.DASHBOARD_OAUTH_CLIENT_SECRET?.trim() || null,
    sessionSecret: process.env.DASHBOARD_SESSION_SECRET?.trim() || null,
    adminUserIds: identifiers(process.env.DASHBOARD_ADMIN_DISCORD_IDS),
    get oauthConfigured() {
      return Boolean(this.publicUrl && this.oauthClientId && this.oauthClientSecret && this.sessionSecret);
    }
  }
};
