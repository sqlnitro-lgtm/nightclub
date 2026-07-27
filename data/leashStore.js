/**
 * leashStore.js - laisses actives (/dog) : qui est en laisse, par qui,
 * son pseudo verrouillé actuel, et son pseudo d'origine (restauré à la
 * libération).
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'leashes.json');

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

function key(guildId, targetId) {
  return `${guildId}:${targetId}`;
}

function getLeash(guildId, targetId) {
  return load()[key(guildId, targetId)] ?? null;
}

/** Le membre actuellement en laisse par ce propriétaire dans ce serveur, ou null. */
function getLeashedByOwner(guildId, ownerId) {
  const all = load();
  return Object.values(all).find((l) => l.guildId === guildId && l.ownerId === ownerId) ?? null;
}

function setLeash(guildId, targetId, ownerId, originalNick, lockedNick) {
  const all = load();
  all[key(guildId, targetId)] = { guildId, targetId, ownerId, originalNick, lockedNick };
  save(all);
}

function removeLeash(guildId, targetId) {
  const all = load();
  delete all[key(guildId, targetId)];
  save(all);
}

module.exports = { getLeash, getLeashedByOwner, setLeash, removeLeash };
