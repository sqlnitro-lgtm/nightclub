const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { removeFromBlacklist, isBlacklisted } = require('../data/blacklistStore');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription("Retire un membre de la liste noire (ne le débannit pas automatiquement)")
    .setContexts([InteractionContextType.Guild])
    .addStringOption((opt) => opt.setName('id').setDescription('ID Discord du membre').setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const userId = interaction.options.getString('id').trim();
    const reason = interaction.options.getString('raison');

    if (!/^\d{17,20}$/.test(userId)) {
      return interaction.reply({ content: 'ID Discord invalide.', ephemeral: true });
    }
    if (!isBlacklisted(interaction.guild.id, userId)) {
      return interaction.reply({ content: `<@${userId}> n'est pas sur la liste noire.`, ephemeral: true });
    }

    removeFromBlacklist(interaction.guild.id, userId);
    await logModAction(interaction.guild, { action: 'unblacklist', target: { id: userId }, moderator: interaction.user, reason });

    const embed = new EmbedBuilder()
      .setColor(0x00b050)
      .setDescription(`<a:1Kiss:1525528118352154674> <@${userId}> retiré de la liste noire (le débannissement du serveur, si besoin, se fait séparément avec \`/unban\`).`);
    await interaction.reply({ embeds: [embed] });
  },
};
