/**
 * helpText.js
 * ------------------------------------------------------------------
 * Génère le texte de /help. Toutes les commandes de modération sont
 * réservées aux Administrateurs (voir /giveadmin et data/permissionHelper.js) :
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
      '> **/ping** — Vérifie que le bot répond.',
      '> **/help** — Cette liste.',
      '> **=find** — Recherche un membre par pseudo, nom ou ID.',
    ]),
  ];

  if (isAdmin) {
    sections.push(
      section('🎭', 'Rôles', [
        "> **/addrole** / **/removerole** — Ajoute/retire un rôle à un membre.",
        "> **/blr** — Bascule le statut BLR (bloque l'attribution de rôle).",
        '> **/massrole** / **/massunrole** — Ajoute/retire un rôle à tous les membres.',
      ]),
      section('🔨', 'Sanctions', [
        '> **/mute** / **/unmute** — Mute manuel (rôle Muted), durée fixe ou indéfini.',
        '> **/timeout** / **/untimeout** — Timeout natif Discord.',
        "> **/warn** / **/unwarn** / **/resetwarnings** — Avertissements.",
        "> **/modlogs** — Historique de modération d'un membre.",
        '> **/kick** — Expulse un membre.',
        '> **/ban** / **/unban** / **/tempban** / **/softban** — Bannissements (définitif, temporaire, ou softban).',
      ]),
      section('🐕', 'Fun', ['> **/dog** — Met un membre en laisse (pseudo verrouillé, te suit en vocal), ou le libère.']),
      section('🔒', 'Salons', [
        '> **/lock** / **/unlock** — Verrouille/déverrouille un salon.',
        '> **/lockall** / **/unlockall** — Verrouille/déverrouille tous les salons.',
        '> **/hidechannel** / **/unhidechannel** — Masque/affiche un salon.',
        '> **/createchannel** / **/deletechannel** / **/renamechannel** — Gère les salons.',
        '> **/slowmode** / **/slowmodeoff** — Mode lent.',
      ]),
      section('🔊', 'Vocal', [
        '> **/voicemute** / **/voiceunmute** — Coupe/réactive le micro en vocal.',
        '> **/voicedeafen** / **/voiceundeafen** — Rend sourd/entendant en vocal.',
        '> **/move** / **/disconnect** — Déplace/déconnecte du vocal.',
        "> **/followuser** — Te déplace automatiquement avec un membre (bascule).",
        '> **=mv \\<id\\>** — Déplace un membre dans ton salon vocal.',
        '> **=pv** — Bascule ton salon vocal courant privé/public.',
      ]),
      section('👤', 'Pseudo', ["> **/nick** / **/resetnickname** — Change/réinitialise le pseudo d'un membre."]),
      section('😀', 'Emojis', ['> **/addemoji** / **/removeemoji** — Gère les emojis du serveur.']),
      section('🧹', 'Messages', [
        '> **/clear** — Supprime les derniers messages du salon.',
        "> **/purge** — Supprime les messages d'un membre précis.",
        '> **/snipe** / **/editsnipe** — Dernier message supprimé/édité du salon.',
      ]),
      section('⛔', 'Listes & Logs', [
        '> **/blacklist** / **/unblacklist** — Liste noire (re-ban automatique au retour).',
        '> **/whitelist** / **/unwhitelist** — Liste blanche (protège du blacklist).',
        '> **/logs** — Configure le salon de logs de modération.',
      ]),
      section('👑', 'Administration', ['> **/giveadmin** / **/removeadmin** — Donne/retire le rôle Admin.'])
    );
  }

  return sections.filter(Boolean).join('\n\n');
}

module.exports = { buildHelpText };
