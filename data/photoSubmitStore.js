/**
 * photoSubmitStore.js - config globale de la soumission de photos par MP
 * (=s&p) : quand activé, une image reçue en MP par le bot déclenche un choix
 * Homme/Femme, puis est postée dans le salon configuré (voir index.js).
 * Un seul salon actif à la fois (pas par serveur : les MP ne sont liés à
 * aucun serveur en particulier).
 *
 * Structure : { enabled: boolean, guildId, channelId }
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'photoSubmit.json');

function load() {
  if (!fs.existsSync(STORE_PATH)) return { enabled: false, guildId: null, channelId: null };
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return { enabled: false, guildId: null, channelId: null };
  }
}

function save(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function getConfig() {
  return load();
}

function setChannel(guildId, channelId) {
  save({ enabled: true, guildId, channelId });
}

function disable() {
  const current = load();
  save({ ...current, enabled: false });
}

module.exports = { getConfig, setChannel, disable };
