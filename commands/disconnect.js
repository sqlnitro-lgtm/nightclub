const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');
const { requireAdmin } = require('../data/permissionHelper');
const { getLeash, removeLeash } = require('../data/leashStore');
const { clearFollow } = require('../data/voiceFollowStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('disconnect')
    .setDescription('Déconnecte un membre du vocal')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre à déconnecter').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const target = await interaction.guild.members.fetch(interaction.options.getUser('membre').id).catch(() => null);

    if (!target) {
      return interaction.reply({ content: 'Ce membre est introuvable sur ce serveur.', ephemeral: true });
    }
    if (!target.voice.channel) {
      return interaction.reply({ content: `<@${target.id}> n'est pas en vocal.`, ephemeral: true });
    }

    const modCheck = canModerate(interaction.guild, interaction.member, target);
    if (!modCheck.ok) return interaction.reply({ content: modCheck.reason, ephemeral: true });

    try {
      await target.voice.disconnect(`Déconnecté par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de déconnecter ce membre : \`${err.message}\`.`, ephemeral: true });
    }

    // Une laisse (/dog) suit automatiquement le propriétaire en vocal : la retirer
    // ici évite que la cible se fasse re-convoquer juste après avoir été déconnectée.
    const leash = getLeash(interaction.guild.id, target.id);
    let leashCleared = false;
    if (leash) {
      await target.setNickname(leash.originalNick, 'Laisse retirée (déconnecté du vocal)').catch(() => {});
      clearFollow(target.id);
      removeLeash(interaction.guild.id, target.id);
      leashCleared = true;
    }

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setDescription(`<a:1Kiss:1525528118352154674> <@${target.id}> déconnecté du vocal.` + (leashCleared ? '\nSa laisse (/dog) a aussi été retirée.' : ''));
    await interaction.reply({ embeds: [embed] });
  },
};
