/**
 * index.js
 * ------------------------------------------------------------------
 * Point d'entrée du bot Discord.
 * - Charge dynamiquement toutes les commandes du dossier /commands.
 * - Gère aussi les commandes préfixées =mv, =pv, =find, =follow, =addmin,
 *   =admin, &warn, &unwarn, &wl, le snipe (messages supprimés/édités), la
 *   liste noire (re-ban automatique) et l'expiration des mutes/tempbans.
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const { isBlacklisted } = require('./data/blacklistStore');
const { addToWhitelist, removeFromWhitelist, isWhitelisted } = require('./data/accessListStore');
const { recordDeleted } = require('./data/snipeStore');
const { getFollowTarget, getFollowersOf, setFollow, clearFollow } = require('./data/voiceFollowStore');
const { getAllMutes, clearMute } = require('./data/muteStore');
const { getAllTempBans, removeTempBan } = require('./data/tempBanStore');
const { findMutedRole } = require('./data/mutedRoleHelper');
const { logModAction } = require('./data/modLogHelper');
const { getLeash } = require('./data/leashStore');
const { canModerate } = require('./data/hierarchyHelper');
const { addWarn, getWarns, removeWarn } = require('./data/warnStore');
const { requireAdminMessage } = require('./data/permissionHelper');

const MV_PREFIX = '=mv';
const PV_PREFIX = '=pv';
const FIND_PREFIX = '=find';
const ADDMIN_PREFIX = '=addmin';
const ADMIN_PREFIX = '=admin';
const FOLLOW_PREFIX = '=follow';
const WARN_PREFIX = '&warn';
const UNWARN_PREFIX = '&unwarn';
const WL_PREFIX = '&wl';
const LOCK_PREFIX = '&lock';
const UNLOCK_PREFIX = '&unlock';
const LOCKALL_PREFIX = '&lockall';
const UNLOCKALL_PREFIX = '&unlockall';
const BAN_PREFIX = '+ban';
const ADMIN_ROLE_NAME = 'Admin';
const CHECK_INTERVAL_MS = 60 * 1000; // vérifie les mutes/tempbans expirés toutes les minutes

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
});

// --------------------------------------------------------------------
// Chargement dynamique des commandes (dossier /commands)
// --------------------------------------------------------------------
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[index] La commande ${file} n'a pas les propriétés "data"/"execute" requises.`);
  }
}

// --------------------------------------------------------------------
// Prêt
// --------------------------------------------------------------------
client.once('clientReady', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  checkExpiredMutesAndBans().catch((err) => console.error('[expiration] Erreur :', err.message));
  setInterval(() => {
    checkExpiredMutesAndBans().catch((err) => console.error('[expiration] Erreur :', err.message));
  }, CHECK_INTERVAL_MS);
});

// --------------------------------------------------------------------
// Gestion des interactions (slash commands)
// --------------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[interactionCreate] Erreur dans la commande ${interaction.commandName} :`, err);
    const errorReply = { content: 'Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorReply).catch(() => {});
    } else {
      await interaction.reply(errorReply).catch(() => {});
    }
  }
});

// --------------------------------------------------------------------
// Liste noire : re-bannit automatiquement quiconque y figure et
// parvient quand même à rejoindre (invité malgré le ban, ou débanni
// ailleurs que par /unblacklist).
// --------------------------------------------------------------------
client.on('guildMemberAdd', async (member) => {
  if (!isBlacklisted(member.guild.id, member.id)) return;

  try {
    await member.ban({ reason: 'Sur la liste noire (/blacklist) : tentative de retour' });
    console.log(`[blacklist] ${member.user.tag} (${member.id}) re-banni automatiquement sur ${member.guild.name}.`);
  } catch (err) {
    console.error(`[blacklist] Impossible de re-bannir ${member.id} sur ${member.guild.name} :`, err.message);
  }
});

// --------------------------------------------------------------------
// Laisse (/dog) : reverrouille le pseudo si la personne en laisse le
// change tant que la laisse tient (le suivi vocal, lui, passe par le
// listener voiceStateUpdate existant, réutilisé via voiceFollowStore).
// --------------------------------------------------------------------
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const leash = getLeash(newMember.guild.id, newMember.id);
  if (!leash) return;
  if (newMember.nickname === leash.lockedNick) return;
  await newMember.setNickname(leash.lockedNick, 'Pseudo verrouillé (laisse /dog active)').catch(() => {});
});

// --------------------------------------------------------------------
// Snipe : mémorise le dernier message supprimé de chaque salon (voir
// /snipe). Ignore les messages de bots.
// --------------------------------------------------------------------
client.on('messageDelete', (message) => {
  if (!message.guild || message.author?.bot) return;
  recordDeleted(message.channel.id, {
    content: message.content,
    authorTag: message.author?.tag ?? 'Inconnu',
    authorAvatarURL: message.author?.displayAvatarURL?.() ?? null,
    imageURL: message.attachments?.first()?.url ?? null,
  });
});

// --------------------------------------------------------------------
// Suivi vocal (=follow) : déplace chaque follower quand la personne
// suivie change de salon vocal.
// --------------------------------------------------------------------
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!newState.channel || newState.channel.id === oldState.channelId) return;

  const followers = getFollowersOf(newState.member.id);
  for (const followerId of followers) {
    const followerMember = await newState.guild.members.fetch(followerId).catch(() => null);
    if (!followerMember?.voice.channel) continue; // ne pas convoquer quelqu'un qui n'est pas déjà en vocal
    await followerMember.voice.setChannel(newState.channel, 'Suivi automatique (=follow)').catch(() => {});
  }
});

// --------------------------------------------------------------------
// Commandes préfixées : =mv (déplace un membre dans ton salon vocal),
// =pv (bascule ton salon vocal courant privé/public), =find (recherche
// un membre par pseudo/ID).
// --------------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.trim();
  const lower = content.toLowerCase();

  if (lower.startsWith(MV_PREFIX)) {
    await handleMv(message, content.slice(MV_PREFIX.length).trim()).catch((err) => console.error('[mv] Erreur :', err.message));
    return;
  }
  if (lower === PV_PREFIX) {
    await handlePv(message).catch((err) => console.error('[pv] Erreur :', err.message));
    return;
  }
  if (lower.startsWith(FIND_PREFIX)) {
    await handleFind(message, content.slice(FIND_PREFIX.length).trim()).catch((err) => console.error('[find] Erreur :', err.message));
    return;
  }

  // Commandes ci-dessous : token exact (évite que "&lock" matche "&lockall").
  const firstSpace = content.indexOf(' ');
  const cmdToken = (firstSpace === -1 ? content : content.slice(0, firstSpace)).toLowerCase();
  const restArgs = firstSpace === -1 ? '' : content.slice(firstSpace + 1).trim();

  switch (cmdToken) {
    case ADDMIN_PREFIX:
      await handleAddmin(message, restArgs).catch((err) => console.error('[addmin] Erreur :', err.message));
      return;
    case ADMIN_PREFIX:
      await handleAdminList(message).catch((err) => console.error('[admin] Erreur :', err.message));
      return;
    case FOLLOW_PREFIX:
      await handleFollow(message, restArgs).catch((err) => console.error('[follow] Erreur :', err.message));
      return;
    case WARN_PREFIX:
      await handleWarn(message, restArgs).catch((err) => console.error('[warn] Erreur :', err.message));
      return;
    case UNWARN_PREFIX:
      await handleUnwarn(message, restArgs).catch((err) => console.error('[unwarn] Erreur :', err.message));
      return;
    case WL_PREFIX:
      await handleWl(message, restArgs).catch((err) => console.error('[wl] Erreur :', err.message));
      return;
    case LOCKALL_PREFIX:
      await handleLockAll(message, true).catch((err) => console.error('[lockall] Erreur :', err.message));
      return;
    case UNLOCKALL_PREFIX:
      await handleLockAll(message, false).catch((err) => console.error('[unlockall] Erreur :', err.message));
      return;
    case LOCK_PREFIX:
      await handleLock(message, true).catch((err) => console.error('[lock] Erreur :', err.message));
      return;
    case UNLOCK_PREFIX:
      await handleLock(message, false).catch((err) => console.error('[unlock] Erreur :', err.message));
      return;
    case BAN_PREFIX:
      await handleBan(message, restArgs).catch((err) => console.error('[ban] Erreur :', err.message));
      return;
  }
});

function extractId(raw) {
  const match = raw.match(/\d{17,20}/);
  return match ? match[0] : null;
}

/** Extrait l'ID/mention en tête de chaîne et retourne { id, rest } (rest = texte libre après, ex. une raison). */
function extractLeadingTarget(raw) {
  const match = raw.match(/^\s*(?:<@!?(\d{17,20})>|(\d{17,20}))\s*/);
  if (!match) return null;
  return { id: match[1] || match[2], rest: raw.slice(match[0].length).trim() };
}

/** =mv <id|@membre> : donne l'accès au salon vocal courant et y déplace la cible si elle est déjà en vocal ailleurs. */
async function handleMv(message, rawTarget) {
  if (!message.member.permissions.has(PermissionFlagsBits.MoveMembers)) {
    await message.reply('Réservé aux modérateurs (permission "Déplacer les membres").');
    return;
  }

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.reply(`Usage : \`${MV_PREFIX} <id ou @membre>\`.`);
    return;
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    await message.reply('Tu dois être en vocal pour utiliser cette commande.');
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.reply('Membre introuvable sur ce serveur.');
    return;
  }

  try {
    await voiceChannel.permissionOverwrites.edit(target.id, { Connect: true, ViewChannel: true });
    if (target.voice.channel) {
      await target.voice.setChannel(voiceChannel, `Déplacé par ${message.author.tag}`);
    }
    await message.reply(`<a:1Kiss:1525528118352154674> <@${target.id}> peut maintenant rejoindre **${voiceChannel.name}**${target.voice.channel ? ' et y a été déplacé' : ''}.`);
  } catch (err) {
    await message.reply(`Impossible de déplacer ce membre : \`${err.message}\`.`);
  }
}

/** =pv : bascule le salon vocal courant privé (deny @everyone Connect) / public. */
async function handlePv(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.reply('Réservé aux modérateurs (permission "Gérer les salons").');
    return;
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    await message.reply('Tu dois être en vocal pour utiliser cette commande.');
    return;
  }

  const everyoneOverwrite = voiceChannel.permissionOverwrites.cache.get(message.guild.id);
  const isPv = everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;

  try {
    await voiceChannel.permissionOverwrites.edit(message.guild.id, { Connect: isPv ? null : false });
    if (!isPv) {
      await voiceChannel.permissionOverwrites.edit(message.author.id, { Connect: true, ViewChannel: true });
    }
    await message.reply(`<a:1Kiss:1525528118352154674> Salon **${voiceChannel.name}** rendu **${isPv ? 'public' : 'privé'}**.`);
  } catch (err) {
    await message.reply(`Impossible de modifier ce salon : \`${err.message}\`.`);
  }
}

/** =find <query> : recherche un membre par pseudo/nom d'utilisateur/ID. */
async function handleFind(message, query) {
  if (!query) {
    await message.reply(`Usage : \`${FIND_PREFIX} <pseudo, nom, ou ID>\`.`);
    return;
  }

  const idMatch = extractId(query);
  const members = await message.guild.members.fetch();

  const results = idMatch
    ? members.filter((m) => m.id === idMatch)
    : members.filter((m) => {
        const q = query.toLowerCase();
        return (
          m.user.username.toLowerCase().includes(q) ||
          m.user.globalName?.toLowerCase().includes(q) ||
          m.nickname?.toLowerCase().includes(q)
        );
      });

  if (results.size === 0) {
    await message.reply(`Aucun membre trouvé pour \`${query}\`.`);
    return;
  }

  const lines = [...results.values()]
    .slice(0, 10)
    .map((m) => `**${m.user.tag}** (\`${m.id}\`)${m.nickname ? ` — pseudo : ${m.nickname}` : ''}`);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Résultats pour "${query}"`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: `${results.size} résultat(s)${results.size > 10 ? ' — 10 premiers affichés' : ''}` });

  await message.reply({ embeds: [embed] });
}

/** =follow <id> : bascule le suivi vocal automatique (relance sur la même cible pour arrêter). */
async function handleFollow(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.reply(`Usage : \`${FOLLOW_PREFIX} <id ou @membre>\`.`);
    return;
  }
  if (targetId === message.author.id) {
    await message.reply('Tu ne peux pas te suivre toi-même.');
    return;
  }

  const current = getFollowTarget(message.author.id);
  if (current === targetId) {
    clearFollow(message.author.id);
    await message.reply(`<a:1Kiss:1525528118352154674> Tu ne suis plus <@${targetId}>.`);
    return;
  }

  setFollow(message.author.id, targetId);
  await message.reply(`<a:bnyear_blue:1525583000031461436> Tu suis maintenant <@${targetId}> en vocal — relance \`${FOLLOW_PREFIX} ${targetId}\` pour arrêter.`);
}

/** &warn <id> <raison> : avertit un membre. */
async function handleWarn(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  const reason = parsed?.rest ?? '';
  if (!targetId || !reason) {
    await message.reply(`Usage : \`${WARN_PREFIX} <id ou @membre> <raison>\`.`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.reply('Ce membre est introuvable sur ce serveur.');
    return;
  }

  const modCheck = canModerate(message.guild, message.member, target);
  if (!modCheck.ok) return message.reply(modCheck.reason);

  const total = addWarn(message.guild.id, target.id, reason, message.author.id);
  await logModAction(message.guild, { action: 'warn', target, moderator: message.author, reason, extra: `Total d'avertissements : **${total}**` }).catch(() => {});
  await target.send({ content: `<:egirl:1526275509464469615> Tu as reçu un avertissement sur **${message.guild.name}** : ${reason}` }).catch(() => {});

  await message.reply(`<:egirl:1526275509464469615> <@${target.id}> a été averti.\n**Raison :** ${reason}\n**Total d'avertissements :** ${total}`);
}

/** &unwarn <id> [numéro] : retire le dernier avertissement, ou un numéro précis (voir &warn). */
async function handleUnwarn(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.reply(`Usage : \`${UNWARN_PREFIX} <id ou @membre> [numéro]\`.`);
    return;
  }

  const rest = parsed.rest;
  const numero = rest ? parseInt(rest, 10) : null;
  if (rest && (Number.isNaN(numero) || numero < 1)) {
    await message.reply(`Usage : \`${UNWARN_PREFIX} <id ou @membre> [numéro]\`.`);
    return;
  }

  const existing = getWarns(message.guild.id, targetId);
  if (existing.length === 0) {
    await message.reply(`<@${targetId}> n'a aucun avertissement.`);
    return;
  }

  const remaining = removeWarn(message.guild.id, targetId, numero ? numero - 1 : null);
  if (remaining === null) {
    await message.reply(`Avertissement n°${numero} introuvable (${existing.length} au total).`);
    return;
  }

  await logModAction(message.guild, { action: 'unwarn', target: { id: targetId }, moderator: message.author, extra: `Avertissements restants : **${remaining}**` }).catch(() => {});
  await message.reply(`<a:1Kiss:1525528118352154674> Avertissement retiré pour <@${targetId}> — il en reste **${remaining}**.`);
}

/** &wl <id> : bascule la liste blanche (protège des commandes de modération sur cette personne). */
async function handleWl(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.reply(`Usage : \`${WL_PREFIX} <id ou @membre>\`.`);
    return;
  }

  if (isWhitelisted(message.guild.id, targetId)) {
    removeFromWhitelist(message.guild.id, targetId);
    await message.reply(`<a:1Kiss:1525528118352154674> <@${targetId}> retiré de la liste blanche.`);
    return;
  }

  addToWhitelist(message.guild.id, targetId);
  await message.reply(`<a:1Kiss:1525528118352154674> <@${targetId}> ajouté à la liste blanche (protégé des commandes de modération).`);
}

/** &lock / &unlock : verrouille/déverrouille le salon où la commande est tapée. */
async function handleLock(message, lock) {
  if (!(await requireAdminMessage(message))) return;

  try {
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: lock ? false : null });
    await message.reply(lock ? `<a:hkhi:1525582949708468374> <#${message.channel.id}> est maintenant verrouillé.` : `<:ethereum:1526711837465378826> <#${message.channel.id}> est maintenant déverrouillé.`);
  } catch (err) {
    await message.reply(`Impossible de modifier ce salon : \`${err.message}\`.`);
  }
}

/** &lockall / &unlockall : verrouille/déverrouille tous les salons texte du serveur. */
async function handleLockAll(message, lock) {
  if (!(await requireAdminMessage(message))) return;

  const textChannels = message.guild.channels.cache.filter((c) => c.type === 0); // GuildText
  let count = 0;
  for (const channel of textChannels.values()) {
    const ok = await channel.permissionOverwrites.edit(message.guild.id, { SendMessages: lock ? false : null }).then(() => true).catch(() => false);
    if (ok) count++;
  }

  await message.reply(lock ? `<a:hkhi:1525582949708468374> ${count}/${textChannels.size} salon(s) verrouillé(s).` : `<:ethereum:1526711837465378826> ${count}/${textChannels.size} salon(s) déverrouillé(s).`);
}

/** +ban <id> <raison> : bannit un membre du serveur. */
async function handleBan(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.reply(`Usage : \`${BAN_PREFIX} <id ou @membre> [raison]\`.`);
    return;
  }
  const reason = parsed.rest || null;

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (target) {
    const modCheck = canModerate(message.guild, message.member, target);
    if (!modCheck.ok) return message.reply(modCheck.reason);
    if (!target.bannable) return message.reply("Le bot n'a pas la permission de bannir ce membre.");
    await target.send({ content: `<a:ableh:1525532035928690688> Tu as été banni de **${message.guild.name}**.${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});
  }

  try {
    await message.guild.members.ban(targetId, { reason: reason ?? undefined });
  } catch (err) {
    await message.reply(`Impossible de bannir ce membre : \`${err.message}\`.`);
    return;
  }

  await logModAction(message.guild, { action: 'ban', target: { id: targetId }, moderator: message.author, reason }).catch(() => {});
  await message.reply(`<a:ableh:1525532035928690688> <@${targetId}> a été banni.` + (reason ? `\n**Raison :** ${reason}` : ''));
}

/** =addmin <id> : donne le rôle Admin. Sans id : affiche la liste des admins (comme =admin). */
async function handleAddmin(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;
  if (!rawTarget) return handleAdminList(message);

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.reply(`Usage : \`${ADDMIN_PREFIX} <id ou @membre>\` (sans id : liste des admins).`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.reply('Ce membre est introuvable sur ce serveur.');
    return;
  }

  let role = message.guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
  if (!role) {
    if (message.guild.members.me.roles.highest.position <= 0) {
      await message.reply("Le bot n'a pas de rôle assez haut pour créer le rôle Admin.");
      return;
    }
    role = await message.guild.roles.create({
      name: ADMIN_ROLE_NAME,
      permissions: [PermissionFlagsBits.Administrator],
      reason: `Rôle Admin créé automatiquement par ${message.author.tag}`,
    });
  }

  if (target.roles.cache.has(role.id)) {
    await message.reply(`<@${target.id}> a déjà le rôle Admin.`);
    return;
  }

  try {
    await target.roles.add(role, `Admin donné par ${message.author.tag}`);
    await message.reply(`<a:1Kiss:1525528118352154674> <@${target.id}> a maintenant le rôle Admin.`);
  } catch (err) {
    await message.reply(`Impossible de donner le rôle Admin : \`${err.message}\`.`);
  }
}

/** =admin : liste tous les membres ayant le rôle Admin. */
async function handleAdminList(message) {
  if (!(await requireAdminMessage(message))) return;

  const role = message.guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
  if (!role || role.members.size === 0) {
    await message.reply('Aucun membre n\'a le rôle Admin pour le moment.');
    return;
  }

  const lines = [...role.members.values()].map((m) => `**${m.user.tag}** (\`${m.id}\`)`);
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Membres avec le rôle Admin')
    .setDescription(lines.join('\n'));
  await message.reply({ embeds: [embed] });
}

// --------------------------------------------------------------------
// Vérifie les mutes et tempbans expirés (voir /mute, /tempban) — appelé
// au démarrage puis toutes les minutes.
// --------------------------------------------------------------------
async function checkExpiredMutesAndBans() {
  const now = Date.now();

  for (const mute of getAllMutes()) {
    if (!mute.expiresAt || mute.expiresAt > now) continue;

    const guild = await client.guilds.fetch(mute.guildId).catch(() => null);
    if (!guild) {
      clearMute(mute.guildId, mute.userId);
      continue;
    }

    const member = await guild.members.fetch(mute.userId).catch(() => null);
    const role = findMutedRole(guild);
    if (member && role && member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Mute expiré').catch(() => {});
    }
    clearMute(mute.guildId, mute.userId);
    if (member) {
      await logModAction(guild, { action: 'unmute', target: member, moderator: client.user, reason: 'Mute expiré' }).catch(() => {});
    }
    console.log(`[mute] Mute expiré retiré pour ${mute.userId} sur ${guild.name}.`);
  }

  for (const ban of getAllTempBans()) {
    if (ban.expiresAt > now) continue;

    const guild = await client.guilds.fetch(ban.guildId).catch(() => null);
    if (!guild) {
      removeTempBan(ban.guildId, ban.userId);
      continue;
    }

    await guild.members.unban(ban.userId, 'Bannissement temporaire expiré').catch(() => {});
    removeTempBan(ban.guildId, ban.userId);
    await logModAction(guild, { action: 'unban', target: { id: ban.userId }, moderator: client.user, reason: 'Bannissement temporaire expiré' }).catch(() => {});
    console.log(`[tempban] Bannissement expiré levé pour ${ban.userId} sur ${guild.name}.`);
  }
}

client.login(process.env.DISCORD_TOKEN);
