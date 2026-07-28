const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');
const { respondPlain } = require('../data/respond');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmodeoff')
    .setDescription('Désactive le mode lent sur un salon')
    .setContexts([InteractionContextType.Guild])
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon concerné (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    try {
      await channel.setRateLimitPerUser(0, `Mode lent désactivé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de désactiver le mode lent : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<a:1Kiss:1525528118352154674> Mode lent désactivé sur <#${channel.id}>.`);
    await respondPlain(interaction, { embeds: [embed] });
  },
};
