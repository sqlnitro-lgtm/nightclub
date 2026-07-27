const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { removeFromWhitelist, isWhitelisted } = require('../data/accessListStore');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unwhitelist')
    .setDescription('Retire un membre de la liste blanche')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetId = interaction.options.getUser('membre').id;

    if (!isWhitelisted(interaction.guild.id, targetId)) {
      return interaction.reply({ content: `<@${targetId}> n'est pas sur la liste blanche.`, ephemeral: true });
    }

    removeFromWhitelist(interaction.guild.id, targetId);
    const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`✅ <@${targetId}> retiré de la liste blanche.`);
    await interaction.reply({ embeds: [embed] });
  },
};
