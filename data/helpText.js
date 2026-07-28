/**
 * helpText.js
 * ------------------------------------------------------------------
 * Génère le texte de /help. Toutes les commandes de modération sont
 * réservées aux Administrateurs (voir =admin et data/permissionHelper.js) :
 * un seul indicateur `isAdmin` (propriétaire du bot ou permission
 * Administrator) décide si les sections de modération s'affichent.
 * ------------------------------------------------------------------
 */

function section(emoji, title, lines) {
  if (lines.length === 0) return '';
  return `${emoji} **${title}**\n${lines.map((l) => `> ${l}`).join('\n')}`;
}

function buildHelpText(isAdmin) {
  const sections = [
    section('🌐', 'Tout le monde', [
      '**/help** — Cette liste.',
      '**/pic** `[membre]` — Photo de profil.',
      '**/banner** `[membre]` — Bannière.',
      '**=ui** `[id]` — Fiche complète d\'un membre.',
      '**=find** `<pseudo|id>` — Recherche un membre.',
    ]),
  ];

  if (!isAdmin) return sections.filter(Boolean).join('\n\n');

  sections.push(
    section('👑', 'Administration', [
      '**=admin** `<id>` — Donne le rôle Admin, ou le retire s\'il l\'a déjà (bascule).',
      '**=admin** — Liste tous les admins du serveur.',
    ]),
    section('🎭', 'Rôles', [
      '**/role** · **/delrole** — Ajoute/retire un rôle à un membre.',
      '**/massrole** · **/massunrole** — Ajoute/retire un rôle à tous les membres.',
      '**/blr** — Bloque l\'attribution de rôle à un membre (bascule).',
      '**=link** `<id> <id> [id] [id]` — Lie 2 à 4 rôles : en donner un donne les autres.',
    ]),
    section('🔨', 'Sanctions', [
      '**&warn** `<id> <raison>` · **&unwarn** `<id> [n°]` — Avertissements.',
      '**/mute** · **/unmute** — Mute par rôle, durée au choix.',
      '**/to** · **/unto** — Timeout natif Discord.',
      '**/kick** — Expulse un membre.',
      '**+ban** `<id> [raison]` · **+unban** `<id>` — Bannissement définitif.',
      '**/tempban** · **/softban** — Bannissement temporaire ou purge de messages.',
    ]),
    section('🛡️', 'Automod & listes', [
      '**=automod** — Active/désactive le filtre de mots (bascule).',
      '**=mod** `<mot>` — Ajoute/retire un mot interdit (dérivés et contournements inclus).',
      '**=mod** — Affiche la liste des mots interdits.',
      '**&bl** `<id> [raison]` · **&unbl** `<id>` — Liste noire (re-ban automatique au retour).',
      '**&wl** `<id>` — Liste blanche : immunise contre toute commande de modération.',
    ]),
    section('🧹', 'Messages', [
      '**&clear** `[nombre]` — Sans argument : 67 dernières minutes. Sinon ce nombre (max 1000).',
      '**&purge** `<id> [nombre]` — Supprime les messages d\'un membre.',
      '**+snipe** `[#salon]` — Dernier message supprimé.',
    ]),
    section('🔒', 'Salons', [
      '**&lock** · **&unlock** — Verrouille/déverrouille le salon courant.',
      '**&l0all** — Verrouille tous les salons, relance pour tout rouvrir (bascule).',
      '**&channel** — Menu à boutons : créer, supprimer, renommer, masquer, afficher.',
      '**/slowmode** · **/slowmodeoff** — Mode lent.',
    ]),
    section('🔊', 'Vocal', [
      '**&muet** `<id>` · **&sourd** `<id>` — Coupe le micro / rend sourd (bascule).',
      '**=menotte** `<id>` — Bloque un membre dans son salon vocal jusqu\'à ce qu\'un admin relance la commande.',
      '**=mv** `<id>` — Déplace un membre dans ton salon.',
      '**=follow** `<id>` — Te déplace automatiquement avec un membre (bascule).',
      '**=pv** — Rend ton salon vocal privé/public (bascule).',
      '**/move** · **/disconnect** — Déplace/déconnecte du vocal.',
    ]),
    section('🎫', 'Tickets & photos', [
      '**=ticket** — Poste le panneau de tickets (Admin / Partenariat / Abus).',
      '**=s&p** `[#salon]` — Réception de photos par MP vers ce salon (bascule).',
    ]),
    section('🐕', 'Divers', [
      '**/dog** — Met un membre en laisse : pseudo verrouillé et suivi vocal (bascule).',
      '**/nick** · **/resetnickname** — Change/réinitialise un pseudo.',
      '**/addemoji** · **/removeemoji** — Gère les emojis du serveur.',
      '**/ping** — Mentionne @everyone.',
      '**/logs** `[salon]` — Salon de logs : sanctions, suppressions, mouvements vocaux (bascule).',
    ])
  );

  return sections.filter(Boolean).join('\n\n');
}

module.exports = { buildHelpText };
