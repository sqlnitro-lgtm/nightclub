const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removerole')
    .setDescription("Retire un rôle à un membre")
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addRoleOption((opt) => opt.setName('role').setDescription('Le rôle à retirer').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const role = interaction.options.getRole('role');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.reply({ content: "Le rôle du bot n'est pas assez haut pour retirer ce rôle.", ephemeral: true });
    }

    if (!target.roles.cache.has(role.id)) {
      return interaction.reply({ content: `<@${target.id}> n'a pas le rôle <@&${role.id}>.`, ephemeral: true });
    }

    try {
      await target.roles.remove(role, `Retiré par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de retirer ce rôle : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setDescription(`✅ Rôle <@&${role.id}> retiré à <@${target.id}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
