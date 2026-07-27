const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { buildHelpText } = require('../data/helpText');
const { isOwner } = require('../data/ownerStore');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Liste des commandes disponibles (selon tes permissions)'),

  async execute(interaction) {
    const isAdmin = isOwner(interaction.user.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('🍸 Commandes du serveur')
      .setDescription(buildHelpText(isAdmin));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
