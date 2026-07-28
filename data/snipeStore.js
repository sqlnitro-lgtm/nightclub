/**
 * snipeStore.js - dernier message supprimé par salon (en mémoire uniquement,
 * perdu au redémarrage — usage volatil comme sur la plupart des bots de
 * modération). Voir /snipe.
 */
const deletedByChannel = new Map();

function recordDeleted(channelId, entry) {
  deletedByChannel.set(channelId, { ...entry, at: Date.now() });
}

function getDeleted(channelId) {
  return deletedByChannel.get(channelId) ?? null;
}

module.exports = { recordDeleted, getDeleted };
