const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType, InteractionContextType} = require('discord.js');
const { setLogChannel, getLogChannelId, clearLogChannel } = require('../data/modLogStore');
const { requireAdmin } = require('../data/permissionHelper');
const { respondPlain } = require('../data/respond');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure le salon de logs (bascule : relance sur le même salon pour désactiver)')
    .setContexts([InteractionContextType.Guild])
    .addChannelOption((opt) =>
      opt.setName('salon').setDescription('Le salon de logs (laisse vide pour voir la config actuelle)').addChannelTypes(ChannelType.GuildText).setRequired(false)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const channel = interaction.options.getChannel('salon');
    const currentId = getLogChannelId(interaction.guild.id);

    if (!channel) {
      return interaction.reply({
        content: currentId ? `Salon de logs actuel : <#${currentId}>.` : 'Aucun salon de logs configuré.',
        ephemeral: true,
      });
    }

    // Bascule : relancer /logs sur le salon déjà configuré désactive les logs.
    if (channel.id === currentId) {
      clearLogChannel(interaction.guild.id);
      const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`<a:1Kiss:1525528118352154674> Logs désactivés (<#${channel.id}> ne recevra plus les logs).`);
      return respondPlain(interaction, { embeds: [embed] });
    }

    setLogChannel(interaction.guild.id, channel.id);
    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<a:1Kiss:1525528118352154674> Salon de logs défini sur <#${channel.id}>.`);
    await respondPlain(interaction, { embeds: [embed] });
  },
};
