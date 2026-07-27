/**
 * /whitelist - protège un membre : impossible de le blacklister ni de le
 * blacklister par erreur pendant qu'il est whitelisté (voir /blacklist).
 */
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType} = require('discord.js');
const { addToWhitelist, isWhitelisted } = require('../data/accessListStore');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Ajoute un membre à la liste blanche (protégé du blacklist)')
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné').setRequired(true)),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetId = interaction.options.getUser('membre').id;

    if (isWhitelisted(interaction.guild.id, targetId)) {
      return interaction.reply({ content: `<@${targetId}> est déjà sur la liste blanche.`, ephemeral: true });
    }

    addToWhitelist(interaction.guild.id, targetId);
    const embed = new EmbedBuilder().setColor(0x00b050).setDescription(`✅ <@${targetId}> ajouté à la liste blanche.`);
    await interaction.reply({ embeds: [embed] });
  },
};
