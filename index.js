/**
 * index.js
 * ------------------------------------------------------------------
 * Point d'entrée du bot Discord.
 * - Charge dynamiquement toutes les commandes du dossier /commands.
 * - Gère aussi les commandes préfixées =mv, =pv, =find, le snipe
 *   (messages supprimés/édités), la liste noire (re-ban automatique),
 *   le suivi vocal (/followuser) et l'expiration des mutes/tempbans.
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const { isBlacklisted } = require('./data/blacklistStore');
const { recordDeleted, recordEdited } = require('./data/snipeStore');
const { getFollowTarget, getFollowersOf } = require('./data/voiceFollowStore');
const { getAllMutes, clearMute } = require('./data/muteStore');
const { getAllTempBans, removeTempBan } = require('./data/tempBanStore');
const { findMutedRole } = require('./data/mutedRoleHelper');
const { logModAction } = require('./data/modLogHelper');

const MV_PREFIX = '=mv';
const PV_PREFIX = '=pv';
const FIND_PREFIX = '=find';
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
// Snipe : mémorise le dernier message supprimé/édité de chaque salon
// (voir /snipe, /editsnipe). Ignore les messages de bots.
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

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return; // évite le bruit des aperçus de lien
  recordEdited(newMessage.channel.id, {
    before: oldMessage.content,
    after: newMessage.content,
    authorTag: newMessage.author?.tag ?? 'Inconnu',
    authorAvatarURL: newMessage.author?.displayAvatarURL?.() ?? null,
  });
});

// --------------------------------------------------------------------
// Suivi vocal (/followuser) : déplace chaque follower quand la personne
// suivie change de salon vocal.
// --------------------------------------------------------------------
client.on('voiceStateUpdate', async (oldState, newState) => {
  if (!newState.channel || newState.channel.id === oldState.channelId) return;

  const followers = getFollowersOf(newState.member.id);
  for (const followerId of followers) {
    const followerMember = await newState.guild.members.fetch(followerId).catch(() => null);
    if (!followerMember?.voice.channel) continue; // ne pas convoquer quelqu'un qui n'est pas déjà en vocal
    await followerMember.voice.setChannel(newState.channel, 'Suivi automatique (/followuser)').catch(() => {});
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
});

function extractId(raw) {
  const match = raw.match(/\d{17,20}/);
  return match ? match[0] : null;
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
    await message.reply(`✅ <@${target.id}> peut maintenant rejoindre **${voiceChannel.name}**${target.voice.channel ? ' et y a été déplacé' : ''}.`);
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
    await message.reply(`✅ Salon **${voiceChannel.name}** rendu **${isPv ? 'public' : 'privé'}**.`);
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
