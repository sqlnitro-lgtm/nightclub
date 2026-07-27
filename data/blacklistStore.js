/**
 * blacklistStore.js - liste noire par serveur : quiconque y figure est
 * re-banni automatiquement s'il tente de revenir (voir guildMemberAdd).
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'blacklist.json');

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

function isBlacklisted(guildId, userId) {
  const all = load();
  return (all[guildId] ?? []).includes(userId);
}

/** Ajoute à la liste noire. Retourne false si déjà présent. */
function addToBlacklist(guildId, userId) {
  const all = load();
  if (!all[guildId]) all[guildId] = [];
  if (all[guildId].includes(userId)) return false;
  all[guildId].push(userId);
  save(all);
  return true;
}

/** Retire de la liste noire. Retourne false si absent. */
function removeFromBlacklist(guildId, userId) {
  const all = load();
  if (!all[guildId]?.includes(userId)) return false;
  all[guildId] = all[guildId].filter((id) => id !== userId);
  save(all);
  return true;
}

function getBlacklist(guildId) {
  return load()[guildId] ?? [];
}

module.exports = { isBlacklisted, addToBlacklist, removeFromBlacklist, getBlacklist };
