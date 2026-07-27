const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { findMutedRole } = require('../data/mutedRoleHelper');
const { clearMute, isMuted } = require('../data/muteStore');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retire le mute (rôle Muted) d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const reason = interaction.options.getString('raison');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    if (!isMuted(interaction.guild.id, target.id)) {
      return interaction.reply({ content: `<@${target.id}> n'est pas mute.`, ephemeral: true });
    }

    const role = findMutedRole(interaction.guild);
    if (role && target.roles.cache.has(role.id)) {
      await target.roles.remove(role, `Unmute par ${interaction.user.tag}`).catch(() => {});
    }
    clearMute(interaction.guild.id, target.id);
    await logModAction(interaction.guild, { action: 'unmute', target, moderator: interaction.user, reason });

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`🔊 <@${target.id}> n'est plus mute.`);
    await interaction.reply({ embeds: [embed] });
  },
};
