const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { ensureMutedRole } = require('../data/mutedRoleHelper');
const { setMute, isMuted } = require('../data/muteStore');
const { canModerate } = require('../data/hierarchyHelper');
const { DURATION_CHOICES, DURATION_MS, DURATION_LABEL } = require('../data/durationChoices');
const { logModAction } = require('../data/modLogHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute un membre (rôle Muted, distinct du timeout natif)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à mute').setRequired(true))
    .addStringOption((opt) =>
      opt
        .setName('duree')
        .setDescription('Durée du mute (laisse vide pour un mute indéfini)')
        .setRequired(false)
        .addChoices(...DURATION_CHOICES)
    )
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison du mute').setRequired(false)),

  async execute(interaction) {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const durationKey = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    if (isMuted(interaction.guild.id, target.id)) {
      return interaction.reply({ content: `<@${target.id}> est déjà mute.`, ephemeral: true });
    }

    await interaction.deferReply();

    const role = await ensureMutedRole(interaction.guild).catch(() => null);
    if (!role) {
      return interaction.editReply({ content: "Impossible de créer/trouver le rôle Muted (permissions insuffisantes)." });
    }
    if (interaction.guild.members.me.roles.highest.position <= role.position) {
      return interaction.editReply({ content: "Le rôle du bot n'est pas assez haut pour attribuer le rôle Muted." });
    }

    try {
      await target.roles.add(role, `Mute par ${interaction.user.tag}${reason ? ` : ${reason}` : ''}`);
    } catch (err) {
      return interaction.editReply({ content: `Impossible de mute ce membre : \`${err.message}\`.` });
    }

    const durationMs = durationKey ? DURATION_MS[durationKey] : null;
    setMute(interaction.guild.id, target.id, durationMs);
    await logModAction(interaction.guild, { action: 'mute', target, moderator: interaction.user, reason, extra: durationKey ? `Durée : ${DURATION_LABEL[durationKey]}` : 'Durée : indéfinie' });

    const embed = new EmbedBuilder()
      .setColor(0x999999)
      .setDescription(
        `🔇 <@${target.id}> a été mute${durationKey ? ` pour **${DURATION_LABEL[durationKey]}**` : ' (indéfiniment)'}.` +
          (reason ? `\n**Raison :** ${reason}` : '')
      );
    await interaction.editReply({ embeds: [embed] });
  },
};
