const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getEdited } = require('../data/snipeStore');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editsnipe')
    .setDescription('Affiche le dernier message édité de ce salon (avant/après)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon concerné (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;
    const entry = getEdited(channel.id);

    if (!entry) {
      return interaction.reply({ content: `Aucun message édité récemment dans <#${channel.id}>.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatarURL ?? undefined })
      .addFields(
        { name: 'Avant', value: entry.before || '*(vide)*' },
        { name: 'Après', value: entry.after || '*(vide)*' }
      )
      .setFooter({ text: `Édité dans #${channel.name}` })
      .setTimestamp(entry.at);

    await interaction.reply({ embeds: [embed] });
  },
};
