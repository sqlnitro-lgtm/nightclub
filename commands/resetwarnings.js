const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { resetWarns, getWarns } = require('../data/warnStore');
const { logModAction } = require('../data/modLogHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetwarnings')
    .setDescription("Efface tous les avertissements d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    const targetId = interaction.options.getUser('membre').id;
    const existing = getWarns(interaction.guild.id, targetId);

    if (existing.length === 0) {
      return interaction.reply({ content: `<@${targetId}> n'a aucun avertissement.`, ephemeral: true });
    }

    resetWarns(interaction.guild.id, targetId);
    await logModAction(interaction.guild, { action: 'resetwarnings', target: { id: targetId }, moderator: interaction.user, extra: `${existing.length} avertissement(s) effacé(s)` });

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ ${existing.length} avertissement(s) effacé(s) pour <@${targetId}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
