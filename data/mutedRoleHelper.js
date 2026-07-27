/**
 * mutedRoleHelper.js - trouve ou crée le rôle "Muted" (mute manuel, distinct
 * du timeout natif) et verrouille l'écriture/parole sur tous les salons.
 */
const { ChannelType } = require('discord.js');

const MUTED_ROLE_NAME = 'Muted';

function findMutedRole(guild) {
  return guild.roles.cache.find((r) => r.name === MUTED_ROLE_NAME) ?? null;
}

/** Crée le rôle Muted s'il n'existe pas, avec les surcharges de permission sur chaque salon. */
async function ensureMutedRole(guild) {
  let role = findMutedRole(guild);
  if (role) return role;

  role = await guild.roles.create({
    name: MUTED_ROLE_NAME,
    color: 0x5c5c5c,
    permissions: [],
    reason: 'Création automatique du rôle Muted (première utilisation de /mute)',
  });

  for (const channel of guild.channels.cache.values()) {
    try {
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
        await channel.permissionOverwrites.edit(role, { SendMessages: false, AddReactions: false });
      } else if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
        await channel.permissionOverwrites.edit(role, { Speak: false });
      }
    } catch {
      // Permissions insuffisantes sur ce salon précis : on continue avec les autres.
    }
  }

  return role;
}

module.exports = { findMutedRole, ensureMutedRole, MUTED_ROLE_NAME };
