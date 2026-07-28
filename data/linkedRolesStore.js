/**
 * linkedRolesStore.js - groupes de rôles liés (=link) par serveur : quand un
 * membre reçoit l'un des rôles d'un groupe, les autres lui sont ajoutés
 * automatiquement ; quand un admin bot lui retire l'un d'eux, les autres
 * sont retirés aussi (voir index.js, handleLinkedRoles).
 *
 * Structure : { "<guildId>": [ ["roleId1", "roleId2", ...], ... ] }
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'linkedRoles.json');

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

function getLinkedGroups(guildId) {
  return load()[guildId] ?? [];
}

function addLinkedGroup(guildId, roleIds) {
  const all = load();
  if (!all[guildId]) all[guildId] = [];
  all[guildId].push(roleIds);
  save(all);
}

module.exports = { getLinkedGroups, addLinkedGroup };
