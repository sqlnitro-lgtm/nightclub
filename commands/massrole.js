const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { isBlr } = require('../data/blrStore');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massrole')
    .setDescription('Ajoute un rôle à tous les membres du serveur (respecte le statut BLR)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption((opt) => opt.setName('role').setDescription('Le rôle à attribuer à tous').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const role = interaction.options.getRole('role');

    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.reply({ content: "Le rôle du bot n'est pas assez haut pour attribuer ce rôle.", ephemeral: true });
    }

    await interaction.deferReply();

    const members = await interaction.guild.members.fetch();
    let added = 0;
    let skippedBlr = 0;
    let failed = 0;

    for (const member of members.values()) {
      if (member.user.bot) continue;
      if (member.roles.cache.has(role.id)) continue;
      if (isBlr(interaction.guild.id, member.id)) {
        skippedBlr++;
        continue;
      }
      const ok = await member.roles.add(role, `Mass role par ${interaction.user.tag}`).then(() => true).catch(() => false);
      if (ok) added++;
      else failed++;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00b050)
      .setDescription(
        `✅ Rôle <@&${role.id}> ajouté à **${added}** membre(s).` +
          (skippedBlr > 0 ? `\n🔒 ${skippedBlr} membre(s) ignoré(s) (BLR).` : '') +
          (failed > 0 ? `\n⚠️ ${failed} échec(s).` : '')
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
