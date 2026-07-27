const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType} = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime les derniers messages de ce salon')
    .setContexts([InteractionContextType.Guild])
    .addIntegerOption((opt) =>
      opt.setName('nombre').setDescription('Nombre de messages à supprimer (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const count = interaction.options.getInteger('nombre');

    await interaction.deferReply({ ephemeral: true });

    try {
      // bulkDelete ignore automatiquement les messages de plus de 14 jours ;
      // { filterOld: true } évite une erreur si certains en font partie.
      const deleted = await interaction.channel.bulkDelete(count, true);
      await interaction.editReply({ content: `✅ ${deleted.size} message(s) supprimé(s).` });
    } catch (err) {
      await interaction.editReply({ content: `Impossible de supprimer ces messages : \`${err.message}\`.` });
    }
  },
};
