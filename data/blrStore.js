/**
 * blrStore.js - statut BLR ("bloqué-le-rank") par serveur : tant qu'un
 * membre est BLR, /role et /massrole refusent de lui attribuer un
 * nouveau rôle (voir commands/blr.js).
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'blr.json');

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

function isBlr(guildId, userId) {
  const all = load();
  return (all[guildId] ?? []).includes(userId);
}

/** Bascule le statut BLR. Retourne le nouvel état (true = maintenant BLR). */
function toggleBlr(guildId, userId) {
  const all = load();
  if (!all[guildId]) all[guildId] = [];
  const idx = all[guildId].indexOf(userId);
  let nowBlr;
  if (idx === -1) {
    all[guildId].push(userId);
    nowBlr = true;
  } else {
    all[guildId].splice(idx, 1);
    nowBlr = false;
  }
  save(all);
  return nowBlr;
}

function getBlrList(guildId) {
  return load()[guildId] ?? [];
}

module.exports = { isBlr, toggleBlr, getBlrList };
