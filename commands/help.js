const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { buildHelpText } = require('../data/helpText');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Liste des commandes disponibles (selon tes permissions)'),

  async execute(interaction) {
    const perms = interaction.member.permissions;

    const helpText = buildHelpText({
      manageRoles: perms.has(PermissionFlagsBits.ManageRoles),
      administrator: perms.has(PermissionFlagsBits.Administrator),
      moderateMembers: perms.has(PermissionFlagsBits.ModerateMembers),
      kickMembers: perms.has(PermissionFlagsBits.KickMembers),
      banMembers: perms.has(PermissionFlagsBits.BanMembers),
      manageChannels: perms.has(PermissionFlagsBits.ManageChannels),
      muteMembers: perms.has(PermissionFlagsBits.MuteMembers),
      deafenMembers: perms.has(PermissionFlagsBits.DeafenMembers),
      moveMembers: perms.has(PermissionFlagsBits.MoveMembers),
      manageGuildExpressions: perms.has(PermissionFlagsBits.ManageGuildExpressions),
      manageMessages: perms.has(PermissionFlagsBits.ManageMessages),
      manageNicknames: perms.has(PermissionFlagsBits.ManageNicknames),
    });

    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('🍸 Commandes du serveur').setDescription(helpText);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
