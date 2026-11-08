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
    get rconConfigured() {
      return Boolean(this.rconHost && this.rconPort && this.rconPassword);
    },
    get statusChannelIds() {
      return [...new Set([this.statusChannelId, ...this.statusMirrorChannelIds].filter(Boolean))];
    }
  }
};
