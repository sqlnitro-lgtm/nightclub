/**
 * /giveadmin - attribue le rôle "Admin" (créé au besoin, avec la
 * permission Administrator) à un membre. Réservé aux Administrateurs
 * du serveur : accorder l'accès admin est une action sensible qui ne
 * doit pas être déléguée à quelqu'un qui n'a pas déjà ce niveau.
 */
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const ADMIN_ROLE_NAME = 'Admin';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveadmin')
    .setDescription('Donne le rôle Admin à un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    let role = interaction.guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
    if (!role) {
      if (interaction.guild.members.me.roles.highest.position <= 0) {
        return interaction.reply({ content: "Le bot n'a pas de rôle assez haut pour créer le rôle Admin.", ephemeral: true });
      }
      role = await interaction.guild.roles.create({
        name: ADMIN_ROLE_NAME,
        permissions: [PermissionFlagsBits.Administrator],
        reason: `Rôle Admin créé automatiquement par ${interaction.user.tag}`,
      });
    }

    if (target.roles.cache.has(role.id)) {
      return interaction.reply({ content: `<@${target.id}> a déjà le rôle Admin.`, ephemeral: true });
    }

    try {
      await target.roles.add(role, `Admin donné par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de donner le rôle Admin : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ <@${target.id}> a maintenant le rôle Admin.`);
    await interaction.reply({ embeds: [embed] });
  },
};
