/**
 * /blacklist - bannit un membre ET l'ajoute à la liste noire persistante :
 * s'il revient (ID invité malgré le ban, ou après un débannissement fait
 * ailleurs), guildMemberAdd (index.js) le re-bannit automatiquement.
 */
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addToBlacklist, isBlacklisted } = require('../data/blacklistStore');
const { isWhitelisted } = require('../data/accessListStore');
const { canModerate } = require('../data/hierarchyHelper');
const { logModAction } = require('../data/modLogHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Bannit un membre et le blackliste (re-banni automatiquement s\'il tente de revenir)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true))
    .addStringOption((opt) => opt.setName('raison').setDescription('Raison').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('membre');
    const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const reason = interaction.options.getString('raison');

    if (isBlacklisted(interaction.guild.id, targetUser.id)) {
      return interaction.reply({ content: `<@${targetUser.id}> est déjà sur la liste noire.`, ephemeral: true });
    }
    if (isWhitelisted(interaction.guild.id, targetUser.id)) {
      return interaction.reply({ content: `<@${targetUser.id}> est sur la liste blanche — protégé du blacklist (voir \`/unwhitelist\`).`, ephemeral: true });
    }

    if (target) {
      const modCheck = canModerate(interaction.guild, interaction.member, target);
      if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

      if (!target.bannable) {
        return interaction.reply({ content: "Le bot n'a pas la permission de bannir ce membre.", ephemeral: true });
      }
      await target.send({ content: `⛔ Tu as été blacklisté sur **${interaction.guild.name}**.${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});
    }

    try {
      await interaction.guild.members.ban(targetUser.id, { reason: `Blacklist : ${reason ?? 'aucune raison'}` });
    } catch (err) {
      return interaction.reply({ content: `Impossible de bannir ce membre : \`${err.message}\`.`, ephemeral: true });
    }

    addToBlacklist(interaction.guild.id, targetUser.id);
    await logModAction(interaction.guild, { action: 'blacklist', target: targetUser, moderator: interaction.user, reason });

    const embed = new EmbedBuilder().setColor(0xff0000).setDescription(`⛔ <@${targetUser.id}> a été banni et blacklisté.` + (reason ? `\n**Raison :** ${reason}` : ''));
    await interaction.reply({ embeds: [embed] });
  },
};
