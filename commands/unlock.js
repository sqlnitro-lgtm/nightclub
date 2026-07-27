const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouille un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon à déverrouiller (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
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
