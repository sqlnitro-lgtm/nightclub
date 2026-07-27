const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlockall')
    .setDescription('Déverrouille tous les salons texte du serveur')
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    await interaction.deferReply();

    const textChannels = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
    let count = 0;
    for (const channel of textChannels.values()) {
      const ok = await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null }).then(() => true).catch(() => false);
      if (ok) count++;
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`🔓 ${count}/${textChannels.size} salon(s) déverrouillé(s).`);
    await interaction.editReply({ embeds: [embed] });
  },
};
