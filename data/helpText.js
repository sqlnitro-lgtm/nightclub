/**
 * helpText.js
 * ------------------------------------------------------------------
 * Génère le texte de /help filtré selon les permissions Discord
 * réelles de la personne (pas de whitelist personnalisée ici,
 * contrairement au bot Airline) : une ligne n'apparaît que si la
 * permission requise est vraie. Une section vide disparaît entièrement.
 * ------------------------------------------------------------------
 */

function section(emoji, title, lines) {
  const visible = lines.filter((line) => line.show);
  if (visible.length === 0) return '';
  return `${emoji} **${title}**\n${visible.map((line) => line.text).join('\n')}`;
}

/**
 * @param perms { manageRoles, administrator, moderateMembers, kickMembers,
 *   banMembers, manageChannels, muteMembers, deafenMembers, moveMembers,
 *   manageGuildExpressions, manageMessages, manageNicknames } — booléens,
 *   déjà résolus depuis interaction.member.permissions.
 */
function buildHelpText(perms) {
  const {
    manageRoles,
    administrator,
    moderateMembers,
    kickMembers,
    banMembers,
    manageChannels,
    muteMembers,
    deafenMembers,
    moveMembers,
    manageGuildExpressions,
    manageMessages,
    manageNicknames,
  } = perms;

  const sections = [
    section('🌐', 'Public', [
      { show: true, text: '> **/ping** — Vérifie que le bot répond.' },
      { show: true, text: '> **/help** — Cette liste.' },
      { show: true, text: '> **=find** — Recherche un membre par pseudo, nom ou ID.' },
    ]),

    section('🎭', 'Rôles', [
      { show: manageRoles, text: "> **/addrole** / **/removerole** — Ajoute/retire un rôle à un membre." },
      { show: manageRoles, text: "> **/blr** — Bascule le statut BLR (bloque l'attribution de rôle)." },
      { show: administrator, text: '> **/massrole** / **/massunrole** — Ajoute/retire un rôle à tous les membres.' },
    ]),

    section('🔨', 'Sanctions', [
      { show: manageRoles, text: '> **/mute** / **/unmute** — Mute manuel (rôle Muted), durée fixe ou indéfini.' },
      { show: moderateMembers, text: '> **/timeout** / **/untimeout** — Timeout natif Discord.' },
      { show: moderateMembers, text: "> **/warn** / **/unwarn** / **/resetwarnings** — Avertissements." },
      { show: moderateMembers, text: "> **/modlogs** — Historique de modération d'un membre." },
      { show: kickMembers, text: '> **/kick** — Expulse un membre.' },
      { show: banMembers, text: '> **/ban** / **/unban** / **/tempban** / **/softban** — Bannissements (définitif, temporaire, ou softban).' },
    ]),

    section('🔒', 'Salons', [
      { show: manageChannels, text: '> **/lock** / **/unlock** — Verrouille/déverrouille un salon.' },
      { show: administrator, text: '> **/lockall** / **/unlockall** — Verrouille/déverrouille tous les salons.' },
      { show: manageChannels, text: '> **/hidechannel** / **/unhidechannel** — Masque/affiche un salon.' },
      { show: manageChannels, text: '> **/createchannel** / **/deletechannel** / **/renamechannel** — Gère les salons.' },
      { show: manageChannels, text: '> **/slowmode** / **/slowmodeoff** — Mode lent.' },
    ]),

    section('🔊', 'Vocal', [
      { show: muteMembers, text: '> **/voicemute** / **/voiceunmute** — Coupe/réactive le micro en vocal.' },
      { show: deafenMembers, text: '> **/voicedeafen** / **/voiceundeafen** — Rend sourd/entendant en vocal.' },
      { show: moveMembers, text: '> **/move** / **/disconnect** — Déplace/déconnecte du vocal.' },
      { show: moveMembers, text: "> **/followuser** — Te déplace automatiquement avec un membre (bascule)." },
      { show: moveMembers, text: '> **=mv \\<id\\>** — Déplace un membre dans ton salon vocal.' },
      { show: manageChannels, text: '> **=pv** — Bascule ton salon vocal courant privé/public.' },
    ]),

    section('👤', 'Pseudo', [
      { show: manageNicknames, text: '> **/nick** / **/resetnickname** — Change/réinitialise le pseudo d\'un membre.' },
    ]),

    section('😀', 'Emojis', [
      { show: manageGuildExpressions, text: '> **/addemoji** / **/removeemoji** — Gère les emojis du serveur.' },
    ]),

    section('🧹', 'Messages', [
      { show: manageMessages, text: '> **/clear** — Supprime les derniers messages du salon.' },
      { show: manageMessages, text: "> **/purge** — Supprime les messages d'un membre précis." },
      { show: manageMessages, text: '> **/snipe** / **/editsnipe** — Dernier message supprimé/édité du salon.' },
    ]),

    section('⛔', 'Listes & Logs', [
      { show: administrator, text: '> **/blacklist** / **/unblacklist** — Liste noire (re-ban automatique au retour).' },
      { show: administrator, text: '> **/whitelist** / **/unwhitelist** — Liste blanche (protège du blacklist).' },
      { show: administrator, text: '> **/logs** — Configure le salon de logs de modération.' },
    ]),

    section('👑', 'Administration', [
      { show: administrator, text: '> **/giveadmin** / **/removeadmin** — Donne/retire le rôle Admin.' },
    ]),
  ];

  return sections.filter(Boolean).join('\n\n');
}

module.exports = { buildHelpText };
