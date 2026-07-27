const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { getDeleted } = require('../data/snipeStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Affiche le dernier message supprimé de ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon concerné (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;
    const entry = getDeleted(channel.id);

    if (!entry) {
      return interaction.reply({ content: `Aucun message supprimé récemment dans <#${channel.id}>.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatarURL ?? undefined })
      .setDescription(entry.content || '*(aucun texte — probablement une image/embed)*')
      .setFooter({ text: `Supprimé dans #${channel.name}` })
      .setTimestamp(entry.at);

    if (entry.imageURL) embed.setImage(entry.imageURL);

    await interaction.reply({ embeds: [embed] });
  },
};
