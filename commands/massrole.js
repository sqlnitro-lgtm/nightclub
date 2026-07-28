const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { isBlr } = require('../data/blrStore');
const { requireAdmin } = require('../data/permissionHelper');
const { respondPlain } = require('../data/respond');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('massrole')
    .setDescription('Ajoute un rôle à tous les membres du serveur (respecte le statut BLR)')
    .setContexts([InteractionContextType.Guild])
    .addRoleOption((opt) => opt.setName('role').setDescription('Le rôle à attribuer à tous').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const role = interaction.options.getRole('role');

    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.reply({ content: "Le rôle du bot n'est pas assez haut pour attribuer ce rôle.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    let members;
    try {
      members = await interaction.guild.members.fetch();
    } catch (err) {
      return interaction.editReply({ content: `Impossible de récupérer la liste des membres : \`${err.message}\`.` });
    }

    const targets = [];
    let skippedBlr = 0;
    for (const member of members.values()) {
      if (member.user.bot) continue;
      if (member.roles.cache.has(role.id)) continue;
      if (isBlr(interaction.guild.id, member.id)) {
        skippedBlr++;
        continue;
      }
      targets.push(member);
    }

    // Envoi en parallèle (le client REST de discord.js gère déjà la limite de
    // débit en interne) : sur un gros serveur, l'attente séquentielle membre
    // par membre pouvait donner l'impression que la commande restait bloquée.
    const results = await Promise.allSettled(targets.map((member) => member.roles.add(role, `Mass role par ${interaction.user.tag}`)));
    const added = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - added;

    const embed = new EmbedBuilder()
      .setColor(0x00b050)
      .setDescription(
        `<a:1Kiss:1525528118352154674> Rôle <@&${role.id}> ajouté à **${added}** membre(s).` +
          (skippedBlr > 0 ? `\n<a:hkhi:1525582949708468374> ${skippedBlr} membre(s) ignoré(s) (BLR).` : '') +
          (failed > 0 ? `\n<:egirl:1526275509464469615> ${failed} échec(s).` : '')
      );
    await respondPlain(interaction, { embeds: [embed] });
  },
};
