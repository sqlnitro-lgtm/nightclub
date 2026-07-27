/**
 * ownerStore.js - propriétaires du bot : contournent TOUTE vérification de
 * permission Discord, sur n'importe quel serveur (voir data/permissionHelper.js).
 * OWNER_IDS (en dur) + une liste dynamique gérée via &admin (voir index.js).
 */
const fs = require('node:fs');
const path = require('node:path');

const OWNER_IDS = ['1188970807377019001'];
const STORE_PATH = path.join(__dirname, 'admins.json');

function loadDynamicAdmins() {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveDynamicAdmins(ids) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(ids, null, 2));
}

function isOwner(userId) {
  return OWNER_IDS.includes(userId) || loadDynamicAdmins().includes(userId);
}

/** Bascule (ajoute/retire) un accès total dynamique. Retourne le nouvel état (true = ajouté). Réservé aux OWNER_IDS en dur (voir &admin). */
function toggleDynamicAdmin(userId) {
  const ids = loadDynamicAdmins();
  const idx = ids.indexOf(userId);
  if (idx === -1) {
    ids.push(userId);
    saveDynamicAdmins(ids);
    return true;
  }
  ids.splice(idx, 1);
  saveDynamicAdmins(ids);
  return false;
}

function getDynamicAdmins() {
  return loadDynamicAdmins();
}

module.exports = { OWNER_IDS, isOwner, toggleDynamicAdmin, getDynamicAdmins };
