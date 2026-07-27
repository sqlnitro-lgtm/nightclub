const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addWarn } = require('../data/warnStore');
const { canModerate } = require('../data/hierarchyHelper');
const { logModAction } = require('../data/modLogHelper');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertit un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription("Raison de l'avertissement").setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const reason = interaction.options.getString('raison');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    const total = addWarn(interaction.guild.id, target.id, reason, interaction.user.id);
    await logModAction(interaction.guild, { action: 'warn', target, moderator: interaction.user, reason, extra: `Total d'avertissements : **${total}**` });

    await target.send({ content: `⚠️ Tu as reçu un avertissement sur **${interaction.guild.name}** : ${reason}` }).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setDescription(`⚠️ <@${target.id}> a été averti.\n**Raison :** ${reason}\n**Total d'avertissements :** ${total}`);
    await interaction.reply({ embeds: [embed] });
  },
};
