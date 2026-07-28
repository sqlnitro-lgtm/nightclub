const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

const ADMIN_ROLE_NAME = 'Admin';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeadmin')
    .setDescription('Retire le rôle Admin à un membre')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const role = interaction.guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
    if (!role || !target.roles.cache.has(role.id)) {
      return interaction.reply({ content: `<@${target.id}> n'a pas le rôle Admin.`, ephemeral: true });
    }

    try {
      await target.roles.remove(role, `Admin retiré par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de retirer le rôle Admin : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0xff6600).setDescription(`<a:1Kiss:1525528118352154674> Rôle Admin retiré à <@${target.id}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
