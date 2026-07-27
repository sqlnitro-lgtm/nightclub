const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription("Verrouille un salon (empêche @everyone d'écrire)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon à verrouiller (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;

    try {
      await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
    } catch (err) {
      return interaction.reply({ content: `Impossible de verrouiller ce salon : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`🔒 <#${channel.id}> est maintenant verrouillé.`);
    await interaction.reply({ embeds: [embed] });
  },
};
