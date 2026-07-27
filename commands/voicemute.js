const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { canModerate } = require('../data/hierarchyHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voicemute')
    .setDescription('Coupe le micro d\'un membre en vocal')
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
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
      await target.voice.setMute(true, `Coupé par ${interaction.user.tag}`);
    } catch (err) {
      return interaction.reply({ content: `Impossible de couper le micro : \`${err.message}\`.`, ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(0x999999).setDescription(`🔇 Micro de <@${target.id}> coupé en vocal.`);
    await interaction.reply({ embeds: [embed] });
  },
};
