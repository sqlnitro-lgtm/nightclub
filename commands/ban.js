const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { logModAction } = require('../data/modLogHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un membre du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à bannir').setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison du bannissement').setRequired(false))
    .addIntegerOption((opt) =>
      opt
        .setName('supprimer_messages')
        .setDescription('Supprimer les messages des X derniers jours (0-7, défaut 0)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(7)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const reason = interaction.options.getString('raison');
    const deleteDays = interaction.options.getInteger('supprimer_messages') ?? 0;

    if (target) {
      const modCheck = canModerate(interaction.guild, interaction.member, target);
      if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

      if (!target.bannable) {
        return interaction.reply({ content: "Le bot n'a pas la permission de bannir ce membre.", ephemeral: true });
      }

      await target.send({ content: `🔨 Tu as été banni de **${interaction.guild.name}**.${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});
    }

    try {
      await interaction.guild.members.ban(targetUser.id, { deleteMessageSeconds: deleteDays * 24 * 60 * 60, reason: reason ?? undefined });
    } catch (err) {
      return interaction.reply({ content: `Impossible de bannir ce membre : \`${err.message}\`.`, ephemeral: true });
    }

    await logModAction(interaction.guild, { action: 'ban', target: targetUser, moderator: interaction.user, reason });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setDescription(`🔨 <@${targetUser.id}> a été banni.` + (reason ? `\n**Raison :** ${reason}` : ''));
    await interaction.reply({ embeds: [embed] });
  },
};
