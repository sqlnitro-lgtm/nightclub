/**
 * lockAllStore.js - état du verrouillage global (&l0all) par serveur. On
 * mémorise la liste EXACTE des salons que la commande a verrouillés : au
 * déverrouillage, seuls ceux-là sont rouverts. Les salons déjà privés avant
 * le lockdown (staff, archives...) ne sont donc jamais ouverts par erreur.
 *
 * Structure : {
 *   "<guildId>": { lockedAt: timestamp, by: userId, channelIds: [ ... ] }
 * }
 * Fichier ignoré par Git (état d'exécution).
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'lockAll.json');

function loadAll() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveAll(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

/** L'état du lockdown en cours pour ce serveur, ou null si aucun. */
function getLockAll(guildId) {
  return loadAll()[guildId] ?? null;
}

function setLockAll(guildId, { by, channelIds }) {
  const all = loadAll();
  all[guildId] = { lockedAt: Date.now(), by, channelIds };
  saveAll(all);
}

function clearLockAll(guildId) {
  const all = loadAll();
  if (!all[guildId]) return;
  delete all[guildId];
  saveAll(all);
}

module.exports = { getLockAll, setLockAll, clearLockAll };
