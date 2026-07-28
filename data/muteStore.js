/**
 * muteStore.js - mutes "manuels" (rôle Muted) actifs, avec expiration.
 * Distinct du timeout natif Discord (/to, /unto).
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'mutes.json');

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

/** `durationMs` null = mute indéfini (jusqu'à /unmute manuel). */
function setMute(guildId, userId, durationMs) {
  const all = load();
  all[key(guildId, userId)] = {
    guildId,
    userId,
    expiresAt: durationMs ? Date.now() + durationMs : null,
  };
  save(all);
}

function clearMute(guildId, userId) {
  const all = load();
  delete all[key(guildId, userId)];
  save(all);
}

function isMuted(guildId, userId) {
  return Boolean(load()[key(guildId, userId)]);
}

/** Tous les mutes actifs, tous serveurs confondus — pour la vérification périodique d'expiration. */
function getAllMutes() {
  return Object.values(load());
}

module.exports = { setMute, clearMute, isMuted, getAllMutes };
