/**
 * commands/ping.js
 * ------------------------------------------------------------------
 * Commande /ping - mentionne @everyone (notifie tout le serveur) :
 * réservée aux Administrateurs vu l'impact d'un ping de masse.
 * ------------------------------------------------------------------
 */

const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { requireAdmin } = require('../data/permissionHelper');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Ping @everyone')
    .setContexts([InteractionContextType.Guild]),

  async execute(interaction) {
    if (!(await requireAdmin(interaction))) return;

    await interaction.reply({
      content: '<a:arrow_wh:1525532066890911826> Pong ! @everyone',
      allowedMentions: { parse: ['everyone'] },
    });
  },
};
