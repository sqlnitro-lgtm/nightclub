const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { getHistory } = require('../data/modLogStore');
const { getWarns } = require('../data/warnStore');
const { requireAdmin } = require('../data/permissionHelper');

const ACTION_LABEL = {
  kick: '👢 Expulsion',
  ban: '🔨 Bannissement',
  unban: '✅ Débannissement',
  tempban: '🔨 Bannissement temporaire',
  softban: '🔨 Softban',
  mute: '🔇 Mute',
  unmute: '🔊 Unmute',
  timeout: '⏱️ Timeout',
  untimeout: '✅ Fin de timeout',
  warn: '⚠️ Avertissement',
  unwarn: '✅ Retrait avertissement',
  resetwarnings: '✅ Réinitialisation avertissements',
  blacklist: '⛔ Blacklist',
  unblacklist: '✅ Retrait blacklist',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlogs')
    .setDescription("Affiche l'historique de modération d'un membre")
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetId = interaction.options.getUser('membre').id;
    const history = getHistory(interaction.guild.id, targetId);
    const warnCount = getWarns(interaction.guild.id, targetId).length;

    if (history.length === 0) {
      return interaction.reply({ content: `Aucun historique de modération pour <@${targetId}>.`, ephemeral: true });
    }

    const lines = history
      .slice(-15)
      .reverse()
      .map((entry) => {
        const label = ACTION_LABEL[entry.action] ?? entry.action;
        const date = `<t:${Math.floor(entry.at / 1000)}:R>`;
        return `${label} — par <@${entry.moderatorId}> ${date}${entry.reason ? `\n> ${entry.reason}` : ''}`;
      });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Historique de modération`)
      .setDescription(`<@${targetId}> — **${warnCount}** avertissement(s) actif(s)\n\n${lines.join('\n\n')}`)
      .setFooter({ text: `${history.length} action(s) au total — 15 dernières affichées` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
