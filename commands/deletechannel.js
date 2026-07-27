const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletechannel')
    .setDescription('Supprime un salon')
    .setContexts([InteractionContextType.Guild])
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon à supprimer (défaut : celui-ci)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon') ?? interaction.channel;
    const name = channel.name;

    // Répond avant de supprimer : si le salon ciblé est celui-ci, il n'existe
    // plus pour recevoir quoi que ce soit une fois channel.delete() résolu.
    await interaction.reply({ content: `✅ Salon **${name}** supprimé.`, ephemeral: true });

    try {
      await channel.delete(`Supprimé par ${interaction.user.tag}`);
    } catch (err) {
      await interaction.editReply({ content: `Impossible de supprimer ce salon : \`${err.message}\`.` }).catch(() => {});
    }
  },
};
