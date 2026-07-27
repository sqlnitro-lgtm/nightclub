/**
 * snipeStore.js - dernier message supprimé/édité par salon (en mémoire
 * uniquement, perdu au redémarrage — usage volatil comme sur la plupart
 * des bots de modération). Voir /snipe, /editsnipe.
 */
const deletedByChannel = new Map();
const editedByChannel = new Map();

function recordDeleted(channelId, entry) {
  deletedByChannel.set(channelId, { ...entry, at: Date.now() });
}

function getDeleted(channelId) {
  return deletedByChannel.get(channelId) ?? null;
}

function recordEdited(channelId, entry) {
  editedByChannel.set(channelId, { ...entry, at: Date.now() });
}

function getEdited(channelId) {
  return editedByChannel.get(channelId) ?? null;
}

module.exports = { recordDeleted, getDeleted, recordEdited, getEdited };
