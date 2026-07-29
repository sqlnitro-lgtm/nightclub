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
      '**/help** — Cette liste',
      '**/pic** · **/banner** — Avatar / bannière',
      '**=ui** `[id]` — Fiche membre',
      '**=find** `<pseudo|id>` — Rechercher un membre',
    ]),
  ];

  if (!isAdmin) return sections.filter(Boolean).join('\n\n');

  sections.push(
    section('👑', 'Administration', [
      '**=admin** `<id>` — Donne/retire le rôle Admin',
      '**=admin** — Liste les admins',
    ]),
    section('🎭', 'Rôles', [
      '**/role** · **/delrole** — Ajoute/retire un rôle',
      '**/massrole** · **/massunrole** — Rôle à tout le monde',
      '**/blr** — Bloque les rôles pour un membre',
      '**=link** `<id> <id> [id] [id]` — Lie 2 à 4 rôles entre eux',
    ]),
    section('🔨', 'Sanctions', [
      '**&warn** `<id> <raison>` · **&unwarn** `<id> [n°]` — Avertissements',
      '**/mute** · **/unmute** — Mute par rôle',
      '**/to** · **/unto** — Timeout Discord',
      '**/kick** — Expulse',
      '**+ban** `<id>` · **+unban** `<id>` — Bannit / débannit',
      '**/tempban** · **/softban** — Ban temporaire / purge',
    ]),
    section('🛡️', 'Automod & listes', [
      '**=automod** — Active/désactive le filtre de mots',
      '**=mod** `<mot>` — Ajoute/retire un mot interdit',
      '**=mod** — Liste des mots interdits',
      '**&bl** `<id>` · **&unbl** `<id>` — Liste noire',
      '**&wl** `<id>` — Immunise contre la modération',
    ]),
    section('🧹', 'Messages', [
      '**&clear** `[nombre]` — Vide le salon',
      '**&purge** `<id> [nombre]` — Messages d\'un membre',
      '**+snipe** `[#salon]` — Dernier message supprimé',
    ]),
    section('🔒', 'Salons', [
      '**&lock** · **&unlock** — Ferme/ouvre le salon',
      '**&l0all** — Ferme/ouvre tous les salons',
      '**&channel** — Menu : créer, supprimer, renommer, cacher',
      '**/slowmode** · **/slowmodeoff** — Mode lent',
    ]),
    section('🔊', 'Vocal', [
      '**&muet** `<id>` · **&sourd** `<id>` — Coupe le micro / le son',
      '**=menotte** `<id>` — Bloque dans son salon vocal',
      '**=mv** `<id>` — Amène un membre dans ton salon',
      '**=follow** `<id>` — Le suit automatiquement',
      '**=pv** — Rend ton salon privé/public',
      '**/move** · **/disconnect** — Déplace / déconnecte',
    ]),
    section('🎫', 'Tickets & photos', [
      '**=ticket** — Poste le panneau de tickets (archives dans #ticket-logs)',
      '**=s&p** `[#salon]` — Réception de photos par MP',
    ]),
    section('🐕', 'Divers', [
      '**/dog** — Met un membre en laisse',
      '**/nick** · **/resetnickname** — Change/réinitialise un pseudo',
      '**/addemoji** · **/removeemoji** — Emojis du serveur',
      '**/ping** — Mentionne @everyone',
      '**/logs** `[salon]` — Salon de logs',
    ])
  );

  return sections.filter(Boolean).join('\n\n');
}

module.exports = { buildHelpText };
