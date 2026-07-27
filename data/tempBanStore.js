/**
 * tempBanStore.js - bannissements temporaires en attente de levée automatique.
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'tempbans.json');

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

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function addTempBan(guildId, userId, durationMs) {
  const all = load();
  all[key(guildId, userId)] = { guildId, userId, expiresAt: Date.now() + durationMs };
  save(all);
}

function removeTempBan(guildId, userId) {
  const all = load();
  delete all[key(guildId, userId)];
  save(all);
}

function getAllTempBans() {
  return Object.values(load());
}

module.exports = { addTempBan, removeTempBan, getAllTempBans };
