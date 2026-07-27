/**
 * voiceFollowStore.js - suivi vocal (en mémoire) : qui suit qui, pour
 * /followuser. Perdu au redémarrage, comme un état d'exécution volatil.
 */
const followers = new Map(); // followerId -> targetId

function setFollow(followerId, targetId) {
  followers.set(followerId, targetId);
}

function clearFollow(followerId) {
  followers.delete(followerId);
}

function getFollowTarget(followerId) {
  return followers.get(followerId) ?? null;
}

/** Tous les followerId qui suivent ce targetId. */
function getFollowersOf(targetId) {
  return [...followers.entries()].filter(([, t]) => t === targetId).map(([f]) => f);
}

module.exports = { setFollow, clearFollow, getFollowTarget, getFollowersOf };
