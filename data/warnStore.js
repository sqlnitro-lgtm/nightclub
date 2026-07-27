/**
 * warnStore.js - avertissements par membre (par serveur).
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'warns.json');

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

function addWarn(guildId, userId, reason, moderatorId) {
  const all = load();
  const k = key(guildId, userId);
  if (!all[k]) all[k] = [];
  const entry = { reason, moderatorId, at: Date.now() };
  all[k].push(entry);
  save(all);
  return all[k].length;
}

function getWarns(guildId, userId) {
  return load()[key(guildId, userId)] ?? [];
}

/** Retire le dernier avertissement (ou celui à l'index donné, 0-based). Retourne le nombre restant, ou null si aucun. */
function removeWarn(guildId, userId, index = null) {
  const all = load();
  const k = key(guildId, userId);
  const warns = all[k] ?? [];
  if (warns.length === 0) return null;

  if (index === null) warns.pop();
  else if (index >= 0 && index < warns.length) warns.splice(index, 1);
  else return null;

  all[k] = warns;
  save(all);
  return warns.length;
}

function resetWarns(guildId, userId) {
  const all = load();
  delete all[key(guildId, userId)];
  save(all);
}

module.exports = { addWarn, getWarns, removeWarn, resetWarns };
