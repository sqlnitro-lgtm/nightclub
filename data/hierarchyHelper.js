/**
 * hierarchyHelper.js - vérifications de hiérarchie de rôles partagées par
 * toutes les commandes de modération : on ne peut jamais agir sur quelqu'un
 * de rang égal/supérieur, ni sur le propriétaire du serveur, ni sur un membre
 * whitelisté (&wl), ni si le bot lui-même n'a pas un rôle assez haut pour
 * appliquer l'action.
 */
const { isWhitelisted } = require('./accessListStore');

/** Le membre exécutant peut-il agir sur `target` ? Retourne { ok, reason }. */
function canModerate(guild, executorMember, targetMember) {
  if (targetMember.id === guild.ownerId) {
    return { ok: false, reason: "Impossible d'agir sur le propriétaire du serveur." };
  }
  if (targetMember.id === executorMember.id) {
    return { ok: false, reason: 'Tu ne peux pas utiliser cette commande sur toi-même.' };
  }
  if (isWhitelisted(guild.id, targetMember.id)) {
    return { ok: false, reason: "Cette personne est sur la liste blanche — les commandes de modération n'ont pas d'effet sur elle (voir &wl)." };
  }
  if (guild.ownerId !== executorMember.id && executorMember.roles.highest.position <= targetMember.roles.highest.position) {
    return { ok: false, reason: 'Cette personne a un rôle égal ou supérieur au tien.' };
  }
  return { ok: true, reason: null };
}

/** Le bot a-t-il un rôle assez haut pour agir sur `target` ? */
function botCanAct(guild, targetMember) {
  const botMember = guild.members.me;
  if (targetMember.id === guild.ownerId) {
    return { ok: false, reason: "Impossible d'agir sur le propriétaire du serveur." };
  }
  if (botMember.roles.highest.position <= targetMember.roles.highest.position) {
    return { ok: false, reason: "Le rôle du bot n'est pas assez haut pour agir sur cette personne." };
  }
  return { ok: true, reason: null };
}

module.exports = { canModerate, botCanAct };
