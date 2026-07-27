/**
 * accessListStore.js - liste blanche par serveur (protection contre le
 * blacklist automatique, membres de confiance) : voir /whitelist, /unwhitelist.
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'accessList.json');

function load() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function isWhitelisted(guildId, userId) {
  const all = load();
  return (all[guildId] ?? []).includes(userId);
}

function addToWhitelist(guildId, userId) {
  const all = load();
  if (!all[guildId]) all[guildId] = [];
  if (all[guildId].includes(userId)) return false;
  all[guildId].push(userId);
  save(all);
  return true;
}

function removeFromWhitelist(guildId, userId) {
  const all = load();
  if (!all[guildId]?.includes(userId)) return false;
  all[guildId] = all[guildId].filter((id) => id !== userId);
  save(all);
  return true;
}

function getWhitelist(guildId) {
  return load()[guildId] ?? [];
}

module.exports = { isWhitelisted, addToWhitelist, removeFromWhitelist, getWhitelist };
