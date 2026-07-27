const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetnickname')
    .setDescription("Réinitialise le pseudo d'un membre (retour au nom d'utilisateur)")
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    if (target.id !== interaction.user.id) {
      const modCheck = canModerate(interaction.guild, interaction.member, target);
      if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });
    }

    try {
      await target.setNickname(null, `Réinitialisé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de réinitialiser ce pseudo : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Pseudo de <@${target.id}> réinitialisé.`);
    await interaction.reply({ embeds: [embed] });
  },
};
