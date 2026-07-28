const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { buildHelpText } = require('../data/helpText');
const { isOwner } = require('../data/ownerStore');
const { respondPlain } = require('../data/respond');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Liste des commandes disponibles (selon tes permissions)')
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction) {
    const isAdmin = isOwner(interaction.user.id) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('<a:noeudbleu:1526275226613317693> Commandes du bot')
      .setDescription(buildHelpText(isAdmin))
      .setFooter({
        text: isAdmin
          ? 'Les commandes de modération sont réservées aux admins (=admin).'
          : 'Certaines commandes sont réservées aux admins et ne sont pas listées.',
      });

    await respondPlain(interaction, { embeds: [embed] });
  },
};
