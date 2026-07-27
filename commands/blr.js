const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { toggleBlr } = require('../data/blrStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blr')
    .setDescription('Bascule le statut BLR (bloqué-le-rank) d\'un membre')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    const targetId = interaction.options.getUser('membre').id;
    const nowBlr = toggleBlr(interaction.guild.id, targetId);

    const embed = new EmbedBuilder()
      .setColor(nowBlr ? 0xff0000 : 0x00b050)
      .setDescription(
        nowBlr
          ? `🔒 <@${targetId}> est maintenant **BLR** — impossible de lui attribuer un nouveau rôle tant que ce statut n'est pas retiré.`
          : `✅ <@${targetId}> n'est plus BLR.`
      );
    await interaction.reply({ embeds: [embed] });
  },
};
