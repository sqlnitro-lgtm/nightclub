/**
 * commands/ping.js
 * ------------------------------------------------------------------
 * Commande /ping - exemple minimal, à copier pour créer de nouvelles
 * commandes.
 * ------------------------------------------------------------------
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Répond pong !'),

  async execute(interaction) {
    await interaction.reply('🏓 Pong !');
  },
};
