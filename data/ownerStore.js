/**
 * ownerStore.js - propriétaires du bot : contournent TOUTE vérification de
 * permission Discord, sur n'importe quel serveur (voir data/permissionHelper.js).
 */
const OWNER_IDS = ['1188970807377019001'];

function isOwner(userId) {
  return OWNER_IDS.includes(userId);
}

module.exports = { OWNER_IDS, isOwner };
