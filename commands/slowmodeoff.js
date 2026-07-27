const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmodeoff')
    .setDescription('Désactive le mode lent sur un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon concerné (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    try {
      await channel.setRateLimitPerUser(0, `Mode lent désactivé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de désactiver le mode lent : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Mode lent désactivé sur <#${channel.id}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
