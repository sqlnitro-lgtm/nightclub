/**
 * photoSubmitStore.js - soumission de photos par MP (=s&p), configurée par
 * serveur : un salon de destination par serveur, plusieurs serveurs peuvent
 * donc l'avoir active en même temps. Quand quelqu'un envoie une image en MP
 * au bot, on lui propose le choix du serveur/catégorie (voir index.js).
 *
 * Structure : { "<guildId>": { channelId: "..." } }
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'photoSubmit.json');

function load() {
  if (!fs.existsSync(STORE_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    // Ancien format (un seul salon global) : { enabled, guildId, channelId }.
    if (raw && typeof raw === 'object' && 'channelId' in raw && 'guildId' in raw) {
      return raw.enabled && raw.guildId && raw.channelId ? { [raw.guildId]: { channelId: raw.channelId } } : {};
    }
    return raw ?? {};
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

/** Le salon configuré pour ce serveur, ou null. */
function getChannelId(guildId) {
  return load()[guildId]?.channelId ?? null;
}

/** Tous les serveurs actifs : [{ guildId, channelId }]. */
function getAllActive() {
  const all = load();
  return Object.entries(all).map(([guildId, cfg]) => ({ guildId, channelId: cfg.channelId }));
}

function setChannel(guildId, channelId) {
  const all = load();
  all[guildId] = { channelId };
  save(all);
}

function disable(guildId) {
  const all = load();
  if (!(guildId in all)) return;
  delete all[guildId];
  save(all);
}

/** Ce salon est-il un salon de soumission (sur n'importe quel serveur) ? */
function isSubmitChannel(channelId) {
  return getAllActive().some((entry) => entry.channelId === channelId);
}

module.exports = { getChannelId, getAllActive, setChannel, disable, isSubmitChannel };
