const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { buildHelpText } = require('../data/helpText');
const { isOwner } = require('../data/ownerStore');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Liste des commandes disponibles (selon tes permissions)')
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction) {
    const isAdmin = isOwner(interaction.user.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('<a:noeudbleu:1526275226613317693> Commandes du serveur')
      .setDescription(buildHelpText(isAdmin));

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
