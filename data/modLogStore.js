/**
 * modLogStore.js - salon de logs configuré par serveur (/logs) + historique
 * des actions de modération par membre.
 */
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, 'modLogConfig.json');
const HISTORY_PATH = path.join(__dirname, 'modLogHistory.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

function setLogChannel(guildId, channelId) {
  const all = loadConfig();
  all[guildId] = channelId;
  saveConfig(all);
}

function getLogChannelId(guildId) {
  return loadConfig()[guildId] ?? null;
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveHistory(data) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2));
}

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

/** Ajoute une entrée à l'historique de modération d'un membre (kick, ban, mute, warn...). */
function addHistoryEntry(guildId, userId, { action, reason, moderatorId }) {
  const all = loadHistory();
  const k = key(guildId, userId);
  if (!all[k]) all[k] = [];
  all[k].push({ action, reason: reason ?? null, moderatorId, at: Date.now() });
  saveHistory(all);
}

function getHistory(guildId, userId) {
  return loadHistory()[key(guildId, userId)] ?? [];
}

module.exports = { setLogChannel, getLogChannelId, addHistoryEntry, getHistory };
