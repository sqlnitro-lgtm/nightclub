const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Active le mode lent sur un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((opt) =>
      opt.setName('secondes').setDescription('Délai entre les messages (0-21600)').setRequired(true).setMinValue(1).setMaxValue(21600)
    )
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon concerné (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;
    const seconds = interaction.options.getInteger('secondes');

    try {
      await channel.setRateLimitPerUser(seconds, `Mode lent activé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible d'activer le mode lent : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x5865f2).setDescription(`🐢 Mode lent activé sur <#${channel.id}> (**${seconds}s**).`);
    await interaction.reply({ embeds: [embed] });
  },
};
