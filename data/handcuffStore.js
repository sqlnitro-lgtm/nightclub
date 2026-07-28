/**
 * handcuffStore.js - menottes vocales (=menotte). Une personne menottée est
 * systématiquement ramenée dans son salon vocal dès qu'elle en change.
 *
 * La menotte est PERSISTANTE : elle survit à une déconnexion vocale comme à
 * un redémarrage du bot. Seule une commande `=menotte <id>` relancée par
 * quelqu'un qui en a le droit la retire.
 *
 * Structure : { "<userId>": { holderId, channelId, guildId } }
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'handcuffs.json');

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

function getHandcuff(userId) {
  return load()[userId] ?? null;
}

function setHandcuff(userId, { holderId, channelId, guildId }) {
  const all = load();
  all[userId] = { holderId, channelId, guildId };
  save(all);
}

function removeHandcuff(userId) {
  const all = load();
  if (!(userId in all)) return false;
  delete all[userId];
  save(all);
  return true;
}

module.exports = { getHandcuff, setHandcuff, removeHandcuff };
