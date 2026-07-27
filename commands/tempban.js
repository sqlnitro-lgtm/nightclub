const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { addTempBan } = require('../data/tempBanStore');
const { DURATION_CHOICES, DURATION_MS, DURATION_LABEL } = require('../data/durationChoices');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('Bannit un membre pour une durée définie (débannissement automatique)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('duree').setDescription('Durée du bannissement').setRequired(true).addChoices(...DURATION_CHOICES)
    )
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetUser = interaction.options.getUser('membre');
    const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const durationKey = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison');

    if (target) {
      const modCheck = canModerate(interaction.guild, interaction.member, target);
      if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

      if (!target.bannable) {
        return interaction.reply({ content: "Le bot n'a pas la permission de bannir ce membre.", ephemeral: true });
      }

      await target.send({ content: `🔨 Tu as été banni temporairement de **${interaction.guild.name}** (${DURATION_LABEL[durationKey]}).${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});
    }

    try {
      await interaction.guild.members.ban(targetUser.id, { reason: reason ?? undefined });
    } catch (err) {
      return interaction.reply({ content: `Impossible de bannir ce membre : \`${err.message}\`.`, ephemeral: true });
    }

    const durationMs = DURATION_MS[durationKey];
    addTempBan(interaction.guild.id, targetUser.id, durationMs);
    await logModAction(interaction.guild, { action: 'tempban', target: targetUser, moderator: interaction.user, reason, extra: `Durée : ${DURATION_LABEL[durationKey]}` });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(`🔨 <@${targetUser.id}> a été banni pour **${DURATION_LABEL[durationKey]}**.` + (reason ? `\n**Raison :** ${reason}` : ''));
    await interaction.reply({ embeds: [embed] });
  },
};
