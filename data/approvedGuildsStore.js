/**
 * approvedGuildsStore.js - liste des serveurs où le propriétaire du bot a
 * autorisé la présence du bot (voir index.js, isGuildPendingApproval). Tant
 * qu'un serveur n'y figure pas, aucune commande (slash ou préfixe) n'y
 * fonctionne.
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'approvedGuilds.json');

function loadApprovedGuilds() {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveApprovedGuilds(ids) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(ids, null, 2));
}

function isGuildApproved(guildId) {
  return loadApprovedGuilds().includes(guildId);
}

function approveGuild(guildId) {
  const ids = loadApprovedGuilds();
  if (!ids.includes(guildId)) {
    ids.push(guildId);
    saveApprovedGuilds(ids);
  }
}

module.exports = { loadApprovedGuilds, saveApprovedGuilds, isGuildApproved, approveGuild };
