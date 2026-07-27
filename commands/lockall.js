const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lockall')
    .setDescription("Verrouille tous les salons texte du serveur")
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply();

    const textChannels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
    let count = 0;
    for (const channel of textChannels.values()) {
      const ok = await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false }).then(() => true).catch(() => false);
      if (ok) count++;
    }

    const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`🔒 ${count}/${textChannels.size} salon(s) verrouillé(s).`);
    await interaction.editReply({ embeds: [embed] });
  },
};
