const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voiceunmute')
    .setDescription("Réactive le micro d'un membre en vocal")
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }
    if (!target.voice.channel) {
      return interaction.reply({ content: `<@${target.id}> n'est pas en vocal.`, ephemeral: true });
    }

    try {
      await target.voice.setMute(false, `Réactivé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de réactiver le micro : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`<a:bnyear_black:1525582808116891798> Micro de <@${target.id}> réactivé en vocal.`);
    await interaction.reply({ embeds: [embed] });
  },
};
