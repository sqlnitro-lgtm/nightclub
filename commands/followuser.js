const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { setFollow, clearFollow, getFollowTarget } = require('../data/voiceFollowStore');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('followuser')
    .setDescription('Te déplace automatiquement dans le même salon vocal qu\'un membre (bascule, relance pour arrêter)')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à suivre')
    .setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetId = interaction.options.getUser('membre').id;

    if (targetId === interaction.user.id) {
      return interaction.reply({ content: 'Tu ne peux pas te suivre toi-même.', ephemeral: true });
    }

    const current = getFollowTarget(interaction.user.id);
    if (current === targetId) {
      clearFollow(interaction.user.id);
      const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`✅ Tu ne suis plus <@${targetId}>.`);
      return interaction.reply({ embeds: [embed] });
    }

    setFollow(interaction.user.id, targetId);
    const embed = new EmbedBuilder().setColor(0x5865f2).setDescription(`👣 Tu suis maintenant <@${targetId}> en vocal — relance \`/followuser\` sur cette personne pour arrêter.`);
    await interaction.reply({ embeds: [embed] });
  },
};
