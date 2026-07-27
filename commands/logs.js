const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { setLogChannel, getLogChannelId } = require('../data/modLogStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure le salon de logs (actions de modération, messages supprimés/édités, arrivées/départs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon de logs (laisse vide pour voir la config actuelle)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon');

    if (!channel) {
      const currentId = getLogChannelId(interaction.guild.id);
      return interaction.reply({
        content: currentId ? `Salon de logs actuel : <#${currentId}>.` : 'Aucun salon de logs configuré.',
        ephemeral: true,
      });
    }

    setLogChannel(interaction.guild.id, channel.id);
    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Salon de logs défini sur <#${channel.id}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
