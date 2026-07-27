const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hidechannel')
    .setDescription('Masque un salon pour @everyone')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon à masquer (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
    } catch (err) {
      return interaction.reply({ content: `Impossible de masquer ce salon : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`👁️‍🗨️ <#${channel.id}> est maintenant masqué pour @everyone.`);
    await interaction.reply({ embeds: [embed] });
  },
};
