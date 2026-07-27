const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouille un salon')
    .setContexts([InteractionContextType.Guild])
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon à déverrouiller (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null });
    } catch (err) {
      return interaction.reply({ content: `Impossible de déverrouiller ce salon : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`🔓 <#${channel.id}> est maintenant déverrouillé.`);
    await interaction.reply({ embeds: [embed] });
  },
};
