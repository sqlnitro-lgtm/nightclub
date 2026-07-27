const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unhidechannel')
    .setDescription('Rend un salon visible pour @everyone')
    .setContexts([InteractionContextType.Guild])
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon à rendre visible (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
    } catch (err) {
      return interaction.reply({ content: `Impossible de rendre ce salon visible : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`👁️ <#${channel.id}> est de nouveau visible pour @everyone.`);
    await interaction.reply({ embeds: [embed] });
  },
};
