/**
 * modLogHelper.js - poste un embed dans le salon de logs configuré (/logs)
 * et enregistre l'action dans l'historique du membre, en un seul
 * appel partagé par toutes les commandes de modération.
 */
const { EmbedBuilder } = require('discord.js');
const { getLogChannelId, addHistoryEntry } = require('./modLogStore');

const ACTION_COLORS = {
  kick: 0xff9900,
  ban: 0xff0000,
  unban: 0x00b050,
  tempban: 0xff0000,
  softban: 0xff6600,
  mute: 0x999999,
  unmute: 0x00b050,
  timeout: 0x999999,
  untimeout: 0x00b050,
  warn: 0xffcc00,
  unwarn: 0x00b050,
  resetwarnings: 0x00b050,
};

/**
 * `target` : User ou GuildMember concerné. `moderator` : User qui a exécuté
 * l'action. `reason` : optionnel. `extra` : lignes supplémentaires (durée...).
 */
async function logModAction(guild, { action, target, moderator, reason = null, extra = null }) {
  addHistoryEntry(guild.id, target.id, { action, reason, moderatorId: moderator.id });

  const channelId = getLogChannelId(guild.id);
  if (!channelId) return;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(ACTION_COLORS[action] ?? 0x5865f2)
    .setTitle(`Modération — ${action}`)
    .setDescription(
      `**Membre :** <@${target.id}> (\`${target.id}\`)\n` +
        `**Modérateur :** <@${moderator.id}>\n` +
        `**Raison :** ${reason ?? '*(aucune)*'}` +
        (extra ? `\n${extra}` : '')
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { logModAction };
