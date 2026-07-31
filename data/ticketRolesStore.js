/**
 * ticketRolesStore.js
 * ------------------------------------------------------------------
 * Quels rôles ont accès à quelle catégorie de ticket, par serveur.
 * Configuré via `=ticket roles`. Ces rôles sont ajoutés aux permissions
 * du salon créé ET mentionnés à l'ouverture, avec le membre.
 *
 * Sans configuration, une catégorie garde le comportement d'origine :
 * seuls le créateur, le bot et le rôle Admin voient le ticket.
 *
 * Structure : { "<guildId>": { "<categoryValue>": ["<roleId>", ...] } }
 * Fichier ignoré par Git (état d'exécution).
 * ------------------------------------------------------------------
 */
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(__dirname, 'ticketRoles.json');

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

/** Les rôles configurés pour une catégorie (tableau vide si aucun). */
function getTicketRoles(guildId, categoryValue) {
  return load()[guildId]?.[categoryValue] ?? [];
}

/** Remplace les rôles d'une catégorie. Une liste vide efface l'entrée. */
function setTicketRoles(guildId, categoryValue, roleIds) {
  const all = load();
  if (!all[guildId]) all[guildId] = {};

  if (!roleIds || roleIds.length === 0) delete all[guildId][categoryValue];
  else all[guildId][categoryValue] = [...new Set(roleIds)];

  if (Object.keys(all[guildId]).length === 0) delete all[guildId];
  save(all);
}

module.exports = { getTicketRoles, setTicketRoles };
