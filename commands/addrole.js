const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { isBlr } = require('../data/blrStore');
const { canModerate } = require('../data/hierarchyHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addrole')
    .setDescription("Ajoute un rôle à un membre")
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addRoleOption((opt) => opt.setName('role').setDescription('Le rôle à ajouter').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const role = interaction.options.getRole('role');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    if (isBlr(interaction.guild.id, target.id)) {
      return interaction.reply({ content: `<@${target.id}> est BLR — impossible de lui attribuer un rôle. Retire d'abord le statut BLR avec \`/blr\`.`, ephemeral: true });
    }

    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.reply({ content: "Le rôle du bot n'est pas assez haut pour attribuer ce rôle.", ephemeral: true });
    }

    if (target.roles.cache.has(role.id)) {
      return interaction.reply({ content: `<@${target.id}> a déjà le rôle <@&${role.id}>.`, ephemeral: true });
    }

    try {
      await target.roles.add(role, `Ajouté par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible d'ajouter ce rôle : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00b050)
      .setDescription(`✅ Rôle <@&${role.id}> ajouté à <@${target.id}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
