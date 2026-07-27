const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { removeWarn, getWarns } = require('../data/warnStore');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwarn')
    .setDescription('Retire le dernier avertissement (ou un numéro précis) d\'un membre')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné')
    .setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('numero').setDescription('Numéro de l\'avertissement à retirer (voir /modlogs) — sinon le dernier').setRequired(false).setMinValue(1)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetId = interaction.options.getUser('membre').id;
    const numero = interaction.options.getInteger('numero');

    const existing = getWarns(interaction.guild.id, targetId);
    if (existing.length === 0) {
      return interaction.reply({ content: `<@${targetId}> n'a aucun avertissement.`, ephemeral: true });
    }

    const remaining = removeWarn(interaction.guild.id, targetId, numero ? numero - 1 : null);
    if (remaining === null) {
      return interaction.reply({ content: `Avertissement n°${numero} introuvable (${existing.length} au total).`, ephemeral: true });
    }

    await logModAction(interaction.guild, { action: 'unwarn', target: { id: targetId }, moderator: interaction.user, extra: `Avertissements restants : **${remaining}**` });

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Avertissement retiré pour <@${targetId}> — il en reste **${remaining}**.`);
    await interaction.reply({ embeds: [embed] });
  },
};
