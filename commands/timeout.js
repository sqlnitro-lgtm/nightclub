const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { DURATION_CHOICES, DURATION_MS, DURATION_LABEL } = require('../data/durationChoices');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout natif Discord (coupe la communication) pour un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('duree').setDescription('Durée du timeout').setRequired(true).addChoices(...DURATION_CHOICES)
    )
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const durationKey = interaction.options.getString('duree');
    const reason = interaction.options.getString('raison');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    if (!target.moderatable) {
      return interaction.reply({ content: "Le bot n'a pas la permission de timeout ce membre.", ephemeral: true });
    }

    try {
      await target.timeout(DURATION_MS[durationKey], reason ?? undefined);
    } catch (err) {
      return interaction.reply({ content: `Impossible de timeout ce membre : \`${err.message}\`.`, ephemeral: true });
    }

    await logModAction(interaction.guild, { action: 'timeout', target, moderator: interaction.user, reason, extra: `Durée : ${DURATION_LABEL[durationKey]}` });

    const embed = new EmbedBuilder()
      .setColor(0x999999)
      .setDescription(`⏱️ <@${target.id}> a reçu un timeout de **${DURATION_LABEL[durationKey]}**.` + (reason ? `\n**Raison :** ${reason}` : ''));
    await interaction.reply({ embeds: [embed] });
  },
};
