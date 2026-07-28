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
    try {
      await interaction.guild.members.fetch();
    } catch (err) {
      return interaction.editReply({ content: `Impossible de récupérer la liste des membres : \`${err.message}\`.` });
    }
    const members = [...role.members.values()];

    // Envoi en parallèle (le client REST de discord.js gère déjà la limite de
    // débit en interne) : sur un gros serveur, l'attente séquentielle membre
    // par membre pouvait donner l'impression que la commande restait bloquée.
    const results = await Promise.allSettled(members.map((member) => member.roles.remove(role, `Mass unrole par ${interaction.user.tag}`)));
    const removed = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - removed;

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setDescription(`<a:1Kiss:1525528118352154674> Rôle <@&${role.id}> retiré à **${removed}** membre(s).` + (failed > 0 ? `\n<:egirl:1526275509464469615> ${failed} échec(s).` : ''));
    await interaction.editReply({ embeds: [embed] });
  },
};
