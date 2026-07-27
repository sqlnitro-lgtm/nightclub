const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription("Supprime les messages d'un membre parmi les derniers messages du salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre dont les messages seront supprimés').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('parmi').setDescription('Nombre de messages récents à examiner (défaut 100, max 200)').setRequired(false).setMinValue(1).setMaxValue(200)
    ),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    const targetId = interaction.options.getUser('membre').id;
    const scanLimit = interaction.options.getInteger('parmi') ?? 100;

    await interaction.deferReply({ ephemeral: true });

    try {
      const fetched = await interaction.channel.messages.fetch({ limit: Math.min(scanLimit, 100) });
      const toDelete = fetched.filter((m) => m.author.id === targetId);

      if (toDelete.size === 0) {
        return interaction.editReply({ content: `Aucun message de <@${targetId}> trouvé parmi les ${Math.min(scanLimit, 100)} derniers.` });
      }

      const deleted = await interaction.channel.bulkDelete(toDelete, true);
      await interaction.editReply({ content: `✅ ${deleted.size} message(s) de <@${targetId}> supprimé(s).` });
    } catch (err) {
      await interaction.editReply({ content: `Impossible de supprimer ces messages : \`${err.message}\`.` });
    }
  },
};
