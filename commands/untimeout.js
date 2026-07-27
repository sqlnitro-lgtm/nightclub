const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logModAction } = require('../data/modLogHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription("Retire le timeout natif d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);
    const reason = interaction.options.getString('raison');

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }
    if (!target.communicationDisabledUntil || target.communicationDisabledUntilTimestamp < Date.now()) {
      return interaction.reply({ content: `<@${target.id}> n'est pas en timeout.`, ephemeral: true });
    }

    try {
      await target.timeout(null, reason ?? undefined);
    } catch (err) {
      return interaction.reply({ content: `Impossible de retirer le timeout : \`${err.message}\`.`, ephemeral: true });
    }

    await logModAction(interaction.guild, { action: 'untimeout', target, moderator: interaction.user, reason });

    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ Timeout retiré pour <@${target.id}>.`);
    await interaction.reply({ embeds: [embed] });
  },
};
