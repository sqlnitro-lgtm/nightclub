const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massunrole')
    .setDescription('Retire un rôle à tous les membres qui l\'ont')
    .setContexts([InteractionContextType.Guild])
    .addRoleOption((opt) => opt.setName('role').setDescription('Le rôle à retirer à tous')
    .setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const role = interaction.options.getRole('role');

    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.reply({ content: "Le rôle du bot n'est pas assez haut pour retirer ce rôle.", ephemeral: true });
    }

    await interaction.deferReply();

    // role.members ne reflète que le cache : un fetch complet garantit qu'on
    // ne rate personne qui n'était pas déjà en cache (gros serveurs).
    await interaction.guild.members.fetch();
    const members = role.members;
    let removed = 0;
    let failed = 0;

    for (const member of members.values()) {
      const ok = await member.roles.remove(role, `Mass unrole par ${interaction.user.tag}`).then(() => true).catch(() => false);
      if (ok) removed++;
      else failed++;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setDescription(`✅ Rôle <@&${role.id}> retiré à **${removed}** membre(s).` + (failed > 0 ? `\n⚠️ ${failed} échec(s).` : ''));
    await interaction.editReply({ embeds: [embed] });
  },
};
