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

/** Deux groupes sont "le même" si ce sont exactement les mêmes rôles, peu importe l'ordre. */
function sameGroup(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * Bascule un groupe de rôles : s'il existe déjà (mêmes rôles, ordre libre),
 * il est retiré ; sinon il est ajouté. Retourne { linked: bool }.
 */
function toggleLinkedGroup(guildId, roleIds) {
  const all = load();
  const groups = all[guildId] ?? [];

  const idx = groups.findIndex((g) => sameGroup(g, roleIds));
  if (idx === -1) {
    groups.push(roleIds);
    all[guildId] = groups;
    save(all);
    return { linked: true };
  }

  groups.splice(idx, 1);
  all[guildId] = groups;
  save(all);
  return { linked: false };
}

module.exports = { getLinkedGroups, toggleLinkedGroup };
