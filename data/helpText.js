/**
 * helpText.js
 * ------------------------------------------------------------------
 * Génère le texte de /help. Toutes les commandes de modération sont
 * réservées aux Administrateurs (voir =addmin et data/permissionHelper.js) :
 * un seul indicateur `isAdmin` (propriétaire du bot ou permission
 * Administrator) décide si les sections de modération s'affichent.
 * ------------------------------------------------------------------
 */

function section(emoji, title, lines) {
  if (lines.length === 0) return '';
  return `${emoji} **${title}**\n${lines.join('\n')}`;
}

function buildHelpText(isAdmin) {
  const sections = [
    section('🌐', 'Public', [
      '> **/help** — Cette liste.',
      '> **=find** — Recherche un membre par pseudo, nom ou ID.',
    ]),
  ];

  if (isAdmin) {
    sections.push(
      section('🎭', 'Rôles', [
        "> **/role** / **/delrole** — Ajoute/retire un rôle à un membre.",
        "> **/blr** — Bascule le statut BLR (bloque l'attribution de rôle).",
        '> **/massrole** / **/massunrole** — Ajoute/retire un rôle à tous les membres.',
      ]),
      section('🔨', 'Sanctions', [
        '> **/mute** / **/unmute** — Mute manuel (rôle Muted), durée fixe ou indéfini.',
        '> **/timeout** / **/untimeout** — Timeout natif Discord.',
        "> **&warn \\<id\\> \\<raison\\>** / **&unwarn \\<id\\> [numéro]** / **/resetwarnings** — Avertissements.",
        '> **/kick** — Expulse un membre.',
        '> **+ban \\<id\\> [raison]** / **/unban** / **/tempban** / **/softban** — Bannissements (définitif, temporaire, ou softban).',
      ]),
      section('🐕', 'Fun', [
        '> **/dog** — Met un membre en laisse (pseudo verrouillé, te suit en vocal), ou le libère.',
        '> **/ping** — Ping @everyone.',
      ]),
      section('🔒', 'Salons', [
        '> **&lock** / **&unlock** — Verrouille/déverrouille le salon où la commande est tapée.',
        '> **&lockall** / **&unlockall** — Verrouille/déverrouille tous les salons.',
        '> **/channels create/delete/rename/hide/unhide** — Gère les salons (création, suppression, renommage, visibilité).',
        '> **/slowmode** / **/slowmodeoff** — Mode lent.',
      ]),
      section('🔊', 'Vocal', [
        '> **/voiceunmute** — Réactive le micro d\'un membre en vocal.',
        '> **/voiceundeafen** — Retire la surdité d\'un membre en vocal.',
        '> **/move** / **/disconnect** — Déplace/déconnecte du vocal (retire aussi la laisse /dog si active).',
        "> **=follow \\<id\\>** — Te déplace automatiquement avec un membre (relance sur la même cible pour arrêter).",
        '> **=mv \\<id\\>** — Déplace un membre dans ton salon vocal.',
        '> **=pv** — Bascule ton salon vocal courant privé/public.',
      ]),
      section('👤', 'Pseudo', ["> **/nick** / **/resetnickname** — Change/réinitialise le pseudo d'un membre."]),
      section('😀', 'Emojis', ['> **/addemoji** / **/removeemoji** — Gère les emojis du serveur.']),
      section('🧹', 'Messages', [
        '> **/clear** — Supprime les derniers messages du salon.',
        "> **/purge** — Supprime les messages d'un membre précis.",
        '> **+snipe [#salon]** — Dernier message supprimé du salon (celui-ci par défaut).',
      ]),
      section('⛔', 'Listes & Logs', [
        '> **/blacklist** / **/unblacklist** — Liste noire (re-ban automatique au retour).',
        '> **&wl \\<id\\>** (bascule) — Liste blanche : bloque toute commande de modération sur cette personne.',
        '> **/logs** — Configure le salon de logs de modération.',
      ]),
      section('👑', 'Administration', [
        '> **=addmin \\<id\\>** — Donne le rôle Admin (sans id : liste les admins).',
        '> **=admin** — Liste tous les membres ayant le rôle Admin.',
      ])
    );
  }

  return sections.filter(Boolean).join('\n\n');
}

module.exports = { buildHelpText };
