const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('renamechannel')
    .setDescription('Renomme un salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) => opt.setName('nouveau_nom').setDescription('Nouveau nom du salon').setRequired(true))
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon à renommer (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory).setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;
    const newName = interaction.options.getString('nouveau_nom');
    const oldName = channel.name;

    try {
      await channel.setName(newName, `Renommé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de renommer ce salon : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Salon **${oldName}** renommé en **${newName}**.`);
    await interaction.reply({ embeds: [embed] });
  },
};
