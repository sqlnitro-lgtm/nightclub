/**
 * index.js
 * ------------------------------------------------------------------
 * Point d'entrée du bot Discord.
 * - Charge dynamiquement toutes les commandes du dossier /commands.
 * - Gère aussi les commandes préfixées =mv, =pv, =find, =follow, =addmin,
 *   =admin, &warn, &unwarn, &wl, &lock, &unlock, &l0all, &channel, &muet,
 *   &sourd, &bl, &unbl, &clear, &purge, +ban, +unban, +snipe, le snipe
 *   (dernier message supprimé), la liste noire (re-ban automatique) et
 *   l'expiration des mutes/tempbans.
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AuditLogEvent,
  Partials,
  ActivityType,
} = require('discord.js');

const { isBlacklisted, addToBlacklist, removeFromBlacklist } = require('./data/blacklistStore');
const { addToWhitelist, removeFromWhitelist, isWhitelisted } = require('./data/accessListStore');
const { recordDeleted, getDeleted } = require('./data/snipeStore');
const { getFollowTarget, getFollowersOf, setFollow, clearFollow } = require('./data/voiceFollowStore');
const { getAllMutes, clearMute } = require('./data/muteStore');
const { getAllTempBans, removeTempBan } = require('./data/tempBanStore');
const { findMutedRole } = require('./data/mutedRoleHelper');
const { logModAction, logEvent } = require('./data/modLogHelper');
const { getLeash } = require('./data/leashStore');
const { canModerate } = require('./data/hierarchyHelper');
const { addWarn, getWarns, removeWarn } = require('./data/warnStore');
const { getLockAll, setLockAll, clearLockAll } = require('./data/lockAllStore');
const { getLinkedGroups, addLinkedGroup } = require('./data/linkedRolesStore');
const {
  getChannelId: getSpChannelId,
  getAllActive: getSpActive,
  setChannel: setSpChannel,
  disable: disableSp,
  isSubmitChannel,
} = require('./data/photoSubmitStore');
const automod = require('./data/automodStore');
const { getHandcuff, setHandcuff, removeHandcuff } = require('./data/handcuffStore');
const { isGuildApproved, approveGuild } = require('./data/approvedGuildsStore');
const { OWNER_IDS, isOwner } = require('./data/ownerStore');
const { requireAdmin, requireAdminMessage } = require('./data/permissionHelper');

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
const L0ALL_PREFIX = '&l0all';
const BAN_PREFIX = '+ban';
const UNBAN_PREFIX = '+unban';
const SNIPE_PREFIX = '+snipe';
const CLEAR_PREFIX = '&clear';
const PURGE_PREFIX = '&purge';
const CHANNEL_PREFIX = '&channel';
const MUET_PREFIX = '&muet';
const SOURD_PREFIX = '&sourd';
const LINK_PREFIX = '=link';
const SP_PREFIX = '=s&p';
const AUTOMOD_PREFIX = '=automod';
const MOD_PREFIX = '=mod';
const MENOTTE_PREFIX = '=menotte';
const UI_PREFIX = '=ui';
const pendingPhotoSubmissions = new Map();
const TICKET_PREFIX = '=ticket';
const TICKET_CATEGORY_NAME = 'tickets';
// Les emojis des boutons sont donnés sous forme d'objet { id, name, animated } :
// c'est la seule façon d'utiliser un emoji personnalisé sur un bouton Discord.
const TICKET_CATEGORIES = [
  {
    value: 'admin',
    prefix: 'admin',
    label: 'Contacter les Admin',
    emoji: { id: '1528368212528336946', name: 'Wcrown', animated: true },
  },
  {
    value: 'contrib',
    prefix: 'contrib',
    label: 'Partenariat',
    emoji: { id: '1526714684600750090', name: 'partner', animated: false },
  },
  {
    value: 'abus',
    prefix: 'abus',
    label: 'Abus',
    emoji: { id: '1525532083366137917', name: 'hkexc', animated: false },
  },
];
const LOCKALL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum];
const ADMIN_ROLE_NAME = 'Admin';
const CHECK_INTERVAL_MS = 60 * 1000; // vérifie les mutes/tempbans expirés toutes les minutes
const DISCORD_CREATION_TS = Date.UTC(2015, 4, 13); // 13 mai 2015, sortie de Discord

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
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
// Autorisation des serveurs : le bot ne fonctionne que sur les serveurs où
// le propriétaire a explicitement autorisé sa présence (voir
// data/approvedGuildsStore.js). Aucun serveur n'est exempté par défaut.
// --------------------------------------------------------------------
const GUILD_APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h

function isGuildPendingApproval(guild) {
  return Boolean(guild) && !isGuildApproved(guild.id);
}

async function requestGuildApproval(guild) {
  const guildOwner = await guild.fetchOwner().catch(() => null);
  const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 5 }).catch(() => null);
  const addedBy = auditLogs ? [...auditLogs.entries.values()].find((e) => e.target?.id === client.user.id)?.executor : null;

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🍸 Nouvelle demande d\'accès')
    .setDescription(
      `**Serveur :** ${guild.name} (\`${guild.id}\`)\n` +
        `**Membres :** ${guild.memberCount}\n` +
        `**Propriétaire du serveur :** ${guildOwner ? `<@${guildOwner.id}>` : 'inconnu'}\n` +
        `**Ajouté par :** ${addedBy ? `<@${addedBy.id}>` : 'inconnu'}\n\n` +
        'Autoriser la présence du bot sur ce serveur ?'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`guildapprove_yes_${guild.id}`).setLabel('Autoriser').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`guildapprove_no_${guild.id}`).setLabel('Refuser').setStyle(ButtonStyle.Danger)
  );

  let dmSent = false;

  for (const ownerId of OWNER_IDS) {
    const ownerUser = await client.users.fetch(ownerId).catch(() => null);
    if (!ownerUser) continue;

    const dm = await ownerUser.send({ embeds: [embed], components: [row] }).catch(() => null);
    if (!dm) continue;
    dmSent = true;

    const collector = dm.createMessageComponentCollector({
      filter: (i) => i.user.id === ownerId,
      time: GUILD_APPROVAL_TIMEOUT_MS,
    });

    collector.on('collect', async (i) => {
      if (i.customId === `guildapprove_yes_${guild.id}`) {
        approveGuild(guild.id);
        await i.update({ content: `<a:1Kiss:1525528118352154674> Serveur **${guild.name}** autorisé.`, embeds: [], components: [] }).catch(() => {});
      } else if (i.customId === `guildapprove_no_${guild.id}`) {
        await i.update({ content: `Serveur **${guild.name}** refusé — le bot va le quitter.`, embeds: [], components: [] }).catch(() => {});
        await client.guilds.cache.get(guild.id)?.leave().catch(() => {});
      }
      collector.stop('resolved');
    });

    collector.on('end', async (_collected, reason) => {
      if (reason === 'resolved' || isGuildApproved(guild.id)) return;
      await dm.edit({ content: `⏱️ Délai dépassé pour **${guild.name}** — départ automatique.`, embeds: [], components: [] }).catch(() => {});
      await client.guilds.cache.get(guild.id)?.leave().catch(() => {});
    });
  }

  if (!dmSent) {
    console.warn(`[approval] Impossible de contacter un propriétaire pour ${guild.name} (${guild.id}) — départ.`);
    await guild.leave().catch(() => {});
  }
}

client.on('guildCreate', async (guild) => {
  if (isGuildApproved(guild.id)) return;
  await requestGuildApproval(guild).catch((err) => console.error('[approval] Erreur :', err.message));
});

// --------------------------------------------------------------------
// Prêt
// --------------------------------------------------------------------
client.once('clientReady', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  // Présence : "Regarde ..." avec un compteur qui part de la création de
  // Discord (13 mai 2015), comme demandé.
  client.user.setPresence({
    status: 'online',
    activities: [
      {
        name: "PV\npv bot t'interrese ? mp affow.",
        type: ActivityType.Watching,
        timestamps: { start: DISCORD_CREATION_TS },
      },
    ],
  });

  for (const guild of client.guilds.cache.values()) {
    if (!isGuildApproved(guild.id)) {
      requestGuildApproval(guild).catch((err) => console.error('[approval] Erreur :', err.message));
    }
  }

  checkExpiredMutesAndBans().catch((err) => console.error('[expiration] Erreur :', err.message));
  setInterval(() => {
    checkExpiredMutesAndBans().catch((err) => console.error('[expiration] Erreur :', err.message));
  }, CHECK_INTERVAL_MS);
});

// --------------------------------------------------------------------
// Gestion des interactions (slash commands, boutons et modals de &channel)
// --------------------------------------------------------------------
client.on('interactionCreate', async (interaction) => {
  if (interaction.guild && isGuildPendingApproval(interaction.guild)) {
    if (interaction.isRepliable()) {
      await interaction
        .reply({ content: "Ce serveur est en attente d'autorisation — le bot n'est pas encore utilisable ici.", ephemeral: true })
        .catch(() => {});
    }
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('nc_channel:')) {
    await handleChannelButton(interaction).catch((err) => console.error('[channel-button] Erreur :', err.message));
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('nc_channel_modal:')) {
    await handleChannelModal(interaction).catch((err) => console.error('[channel-modal] Erreur :', err.message));
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('nc_sp:')) {
    await handleSpButton(interaction).catch((err) => console.error('[sp-button] Erreur :', err.message));
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('nc_ticket:')) {
    await handleTicketButton(interaction).catch((err) => console.error('[ticket-button] Erreur :', err.message));
    return;
  }

  if (interaction.isButton() && interaction.customId === 'nc_ticket_close') {
    await handleTicketClose(interaction).catch((err) => console.error('[ticket-close] Erreur :', err.message));
    return;
  }

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
// ailleurs que par &unbl).
// --------------------------------------------------------------------
client.on('guildMemberAdd', async (member) => {
  if (!isBlacklisted(member.guild.id, member.id)) return;

  try {
    await member.ban({ reason: 'Sur la liste noire (&bl) : tentative de retour' });
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
  if (leash && newMember.nickname !== leash.lockedNick) {
    await newMember.setNickname(leash.lockedNick, 'Pseudo verrouillé (laisse /dog active)').catch(() => {});
  }

  await handleLinkedRoles(oldMember, newMember).catch((err) => console.error('[link] Erreur :', err.message));
});

// --------------------------------------------------------------------
// Rôles liés (=link) : si un membre reçoit l'un des rôles d'un groupe lié,
// les autres lui sont ajoutés automatiquement (quelle que soit la façon
// dont le rôle a été donné : /role, clic droit, etc.). Si un admin bot
// (propriétaire ou rôle Admin) lui retire l'un d'eux, les autres sont
// retirés aussi. Un court "cooldown" empêche nos propres ajouts/retraits
// en cascade de se re-déclencher eux-mêmes.
// --------------------------------------------------------------------
const linkCascadeCooldown = new Set();

async function handleLinkedRoles(oldMember, newMember) {
  if (linkCascadeCooldown.has(newMember.id)) return;

  const groups = getLinkedGroups(newMember.guild.id);
  if (groups.length === 0) return;

  const oldRoleIds = new Set(oldMember.roles.cache.keys());
  const newRoleIds = new Set(newMember.roles.cache.keys());
  const added = [...newRoleIds].filter((id) => !oldRoleIds.has(id));
  const removed = [...oldRoleIds].filter((id) => !newRoleIds.has(id));
  if (added.length === 0 && removed.length === 0) return;

  let didCascade = false;

  for (const group of groups) {
    if (added.some((id) => group.includes(id))) {
      const missing = group.filter((id) => !newMember.roles.cache.has(id));
      for (const roleId of missing) {
        didCascade = true;
        await newMember.roles.add(roleId, 'Rôle lié (=link)').catch(() => {});
      }
    }

    if (removed.some((id) => group.includes(id))) {
      const removedByAdmin = await wasRoleChangeByBotAdmin(newMember);
      if (!removedByAdmin) continue;
      const stillPresent = group.filter((id) => newMember.roles.cache.has(id));
      for (const roleId of stillPresent) {
        didCascade = true;
        await newMember.roles.remove(roleId, 'Rôle lié retiré (=link)').catch(() => {});
      }
    }
  }

  if (didCascade) {
    linkCascadeCooldown.add(newMember.id);
    setTimeout(() => linkCascadeCooldown.delete(newMember.id), 3000);
  }
}

/** Le dernier changement de rôle de ce membre a-t-il été fait par le propriétaire ou un Admin bot ? */
async function wasRoleChangeByBotAdmin(member) {
  const logs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 }).catch(() => null);
  if (!logs) return false;

  const entry = [...logs.entries.values()].find((e) => e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000);
  if (!entry?.executor) return false;

  if (isOwner(entry.executor.id)) return true;
  const executorMember = await member.guild.members.fetch(entry.executor.id).catch(() => null);
  return executorMember?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
}

// --------------------------------------------------------------------
// Snipe : mémorise le dernier message supprimé de chaque salon (voir
// +snipe) et l'envoie dans le salon de logs (/logs). Ignore les bots.
// --------------------------------------------------------------------
client.on('messageDelete', (message) => {
  if (!message.guild || message.author?.bot) return;
  recordDeleted(message.channel.id, {
    content: message.content,
    authorTag: message.author?.tag ?? 'Inconnu',
    authorAvatarURL: message.author?.displayAvatarURL?.() ?? null,
    imageURL: message.attachments?.first()?.url ?? null,
  });

  logEvent(message.guild, {
    title: 'Modération — messageDelete',
    color: 0xff6600,
    description:
      `**Auteur :** <@${message.author?.id ?? 'inconnu'}>\n` +
      `**Salon :** <#${message.channel.id}>\n` +
      `**Contenu :**\n${message.content || '*(aucun texte — image/embed)*'}`,
  }).catch(() => {});
});

// --------------------------------------------------------------------
// Suivi vocal (=follow) : déplace chaque follower quand la personne
// suivie change de salon vocal. Journalise aussi tout changement de
// salon vocal (arrivée/départ/déplacement) dans le salon de logs.
// --------------------------------------------------------------------
client.on('voiceStateUpdate', async (oldState, newState) => {
  logVoiceStateChange(oldState, newState).catch((err) => console.error('[voice-log] Erreur :', err.message));

  // Menotte (=menotte) : ramène la personne dans son salon dès qu'elle bouge.
  // La menotte ne tombe JAMAIS toute seule (ni en se déconnectant, ni au
  // redémarrage du bot) : seul un admin qui refait `=menotte <id>` la retire.
  const userId = newState.id ?? oldState.id;
  const cuff = getHandcuff(userId);
  if (cuff && newState.channelId && newState.channelId !== cuff.channelId) {
    await newState.setChannel(cuff.channelId, 'Menotté(e) (=menotte)').catch((err) => console.error('[menotte] Impossible de ramener :', err.message));
    return;
  }

  if (!newState.channel || newState.channel.id === oldState.channelId) return;

  const followers = getFollowersOf(newState.member.id);
  for (const followerId of followers) {
    const followerMember = await newState.guild.members.fetch(followerId).catch(() => null);
    if (!followerMember?.voice.channel) continue; // ne pas convoquer quelqu'un qui n'est pas déjà en vocal
    await followerMember.voice.setChannel(newState.channel, 'Suivi automatique (=follow)').catch(() => {});
  }
});

/** Journalise arrivée/départ/déplacement de salon vocal dans le salon de logs (/logs). */
async function logVoiceStateChange(oldState, newState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  if (!oldState.channelId && newState.channelId) {
    await logEvent(newState.guild, {
      title: 'Modération — voiceJoin',
      color: 0x00b050,
      description: `<@${member.id}> a rejoint <#${newState.channelId}>.`,
    });
  } else if (oldState.channelId && !newState.channelId) {
    await logEvent(oldState.guild, {
      title: 'Modération — voiceLeave',
      color: 0xff6600,
      description: `<@${member.id}> a quitté <#${oldState.channelId}>.`,
    });
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    await logEvent(newState.guild, {
      title: 'Modération — voiceMove',
      color: 0x5865f2,
      description: `<@${member.id}> est passé de <#${oldState.channelId}> à <#${newState.channelId}>.`,
    });
  }
}

// --------------------------------------------------------------------
// Soumission de photos par MP (=s&p) : une image reçue en MP (quand activé)
// propose un choix Homme/Femme ; voir handleSpButton pour la suite.
// --------------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot || message.guild) return; // uniquement les MP

  const image = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (!image) return;

  // Un serveur n'est proposé que si la personne en est membre : sinon elle
  // pourrait poster sur des serveurs qu'elle ne fréquente pas.
  const active = [];
  for (const entry of getSpActive()) {
    const guild = client.guilds.cache.get(entry.guildId);
    if (!guild) continue;
    const member = await guild.members.fetch(message.author.id).catch(() => null);
    if (member) active.push({ ...entry, guild });
  }
  if (active.length === 0) return;

  const token = Math.random().toString(36).slice(2, 10);
  pendingPhotoSubmissions.set(token, {
    imageUrl: image.url,
    authorId: message.author.id,
    authorTag: message.author.tag,
  });
  setTimeout(() => pendingPhotoSubmissions.delete(token), 10 * 60 * 1000);

  // Un seul serveur : on va droit au choix Homme/Femme. Plusieurs : on fait
  // d'abord choisir le serveur de destination.
  if (active.length === 1) {
    await message.channel.send(buildSpGenderPrompt(token, active[0].guildId, image.url)).catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('📸 Où veux-tu envoyer cette photo ?')
    .setImage(image.url);
  const row = new ActionRowBuilder().addComponents(
    active.slice(0, 5).map((entry) =>
      new ButtonBuilder().setCustomId(`nc_sp:${token}:guild:${entry.guildId}`).setLabel(entry.guild.name.slice(0, 80)).setStyle(ButtonStyle.Secondary)
    )
  );
  await message.channel.send({ embeds: [embed], components: [row] }).catch(() => {});
});

/** Message proposant le choix Homme/Femme pour une photo, sur un serveur donné. */
function buildSpGenderPrompt(token, guildId, imageUrl) {
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('📸 Choisis ta catégorie')
    .setImage(imageUrl);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`nc_sp:${token}:male:${guildId}`).setLabel('Homme').setEmoji('👨').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`nc_sp:${token}:female:${guildId}`).setLabel('Femme').setEmoji('👩').setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [row] };
}

// --------------------------------------------------------------------
// Commandes préfixées : =mv (déplace un membre dans ton salon vocal),
// =pv (bascule ton salon vocal courant privé/public), =find (recherche
// un membre par pseudo/ID).
// --------------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (isGuildPendingApproval(message.guild)) return; // serveur pas encore autorisé

  // Salon de soumission photo (=s&p) : ne garde que les images postées par le
  // bot — tout message envoyé directement dans ce salon (hors fils, qui ont
  // leur propre ID de salon) est supprimé.
  if (isSubmitChannel(message.channel.id)) {
    await message.delete().catch(() => {});
    return;
  }

  // Automod (=automod / =mod) : supprime les messages contenant un mot
  // interdit, contournements compris. Les admins ne sont pas filtrés.
  if (await enforceAutomod(message)) return;

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
    case ADMIN_PREFIX:
      // =admin et =addmin sont interchangeables : id -> ajoute, sans id -> liste.
      await handleAddmin(message, restArgs).catch((err) => console.error('[addmin] Erreur :', err.message));
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
    case L0ALL_PREFIX:
      await handleL0all(message).catch((err) => console.error('[l0all] Erreur :', err.message));
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
    case SNIPE_PREFIX:
      await handleSnipe(message, restArgs).catch((err) => console.error('[snipe] Erreur :', err.message));
      return;
    case UNBAN_PREFIX:
      await handleUnban(message, restArgs).catch((err) => console.error('[unban] Erreur :', err.message));
      return;
    case CLEAR_PREFIX:
      await handleClear(message, restArgs).catch((err) => console.error('[clear] Erreur :', err.message));
      return;
    case PURGE_PREFIX:
      await handlePurge(message, restArgs).catch((err) => console.error('[purge] Erreur :', err.message));
      return;
    case CHANNEL_PREFIX:
      await handleChannelMenu(message).catch((err) => console.error('[channel] Erreur :', err.message));
      return;
    case MUET_PREFIX:
      await handleMuet(message, restArgs).catch((err) => console.error('[muet] Erreur :', err.message));
      return;
    case SOURD_PREFIX:
      await handleSourd(message, restArgs).catch((err) => console.error('[sourd] Erreur :', err.message));
      return;
    case LINK_PREFIX:
      await handleLink(message, restArgs).catch((err) => console.error('[link] Erreur :', err.message));
      return;
    case SP_PREFIX:
      await handleSp(message, restArgs).catch((err) => console.error('[sp] Erreur :', err.message));
      return;
    case TICKET_PREFIX:
      await handleTicketPanel(message).catch((err) => console.error('[ticket] Erreur :', err.message));
      return;
    case AUTOMOD_PREFIX:
      await handleAutomod(message).catch((err) => console.error('[automod] Erreur :', err.message));
      return;
    case MOD_PREFIX:
      await handleMod(message, restArgs).catch((err) => console.error('[mod] Erreur :', err.message));
      return;
    case MENOTTE_PREFIX:
      await handleMenotte(message, restArgs).catch((err) => console.error('[menotte] Erreur :', err.message));
      return;
    case UI_PREFIX:
      await handleUi(message, restArgs).catch((err) => console.error('[ui] Erreur :', err.message));
      return;
  }
});

/**
 * Applique l'automod : supprime le message s'il contient un mot interdit.
 * Retourne true si le message a été supprimé. Les admins bot en sont exemptés.
 */
async function enforceAutomod(message) {
  if (!message.content) return false;
  if (isOwner(message.author.id)) return false;
  if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return false;

  const banned = automod.findBannedWord(message.guild.id, message.content);
  if (!banned) return false;

  await message.delete().catch(() => {});

  const warning = await message.channel
    .send(`<:egirl:1526275509464469615> <@${message.author.id}>, ce mot est interdit ici.`)
    .catch(() => null);
  if (warning) setTimeout(() => warning.delete().catch(() => {}), 5000);

  await logEvent(message.guild, {
    title: 'Automod — message supprimé',
    color: 0xff6600,
    description:
      `**Auteur :** <@${message.author.id}>\n` +
      `**Salon :** <#${message.channel.id}>\n` +
      `**Mot interdit :** \`${banned}\`\n` +
      `**Message :**\n${message.content.slice(0, 900)}`,
  }).catch(() => {});

  return true;
}

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
    await message.channel.send('Réservé aux modérateurs (permission "Déplacer les membres").');
    return;
  }

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.channel.send(`Usage : \`${MV_PREFIX} <id ou @membre>\`.`);
    return;
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    await message.channel.send('Tu dois être en vocal pour utiliser cette commande.');
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.channel.send('Membre introuvable sur ce serveur.');
    return;
  }

  try {
    await voiceChannel.permissionOverwrites.edit(target.id, { Connect: true, ViewChannel: true });
    if (target.voice.channel) {
      await target.voice.setChannel(voiceChannel, `Déplacé par ${message.author.tag}`);
    }
    await message.channel.send(`<a:1Kiss:1525528118352154674> <@${target.id}> peut maintenant rejoindre **${voiceChannel.name}**${target.voice.channel ? ' et y a été déplacé' : ''}.`);
  } catch (err) {
    await message.channel.send(`Impossible de déplacer ce membre : \`${err.message}\`.`);
  }
}

/** =pv : bascule le salon vocal courant privé (deny @everyone Connect) / public. */
async function handlePv(message) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.channel.send('Réservé aux modérateurs (permission "Gérer les salons").');
    return;
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    await message.channel.send('Tu dois être en vocal pour utiliser cette commande.');
    return;
  }

  const everyoneOverwrite = voiceChannel.permissionOverwrites.cache.get(message.guild.id);
  const isPv = everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect) ?? false;

  try {
    await voiceChannel.permissionOverwrites.edit(message.guild.id, { Connect: isPv ? null : false });
    if (!isPv) {
      await voiceChannel.permissionOverwrites.edit(message.author.id, { Connect: true, ViewChannel: true });
    }
    await message.channel.send(`<a:1Kiss:1525528118352154674> Salon **${voiceChannel.name}** rendu **${isPv ? 'public' : 'privé'}**.`);
  } catch (err) {
    await message.channel.send(`Impossible de modifier ce salon : \`${err.message}\`.`);
  }
}

/** =find <query> : recherche un membre par pseudo/nom d'utilisateur/ID. */
async function handleFind(message, query) {
  if (!query) {
    await message.channel.send(`Usage : \`${FIND_PREFIX} <pseudo, nom, ou ID>\`.`);
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
    await message.channel.send(`Aucun membre trouvé pour \`${query}\`.`);
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

  await message.channel.send({ embeds: [embed] });
}

/** =follow <id> : bascule le suivi vocal automatique (relance sur la même cible pour arrêter). */
async function handleFollow(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.channel.send(`Usage : \`${FOLLOW_PREFIX} <id ou @membre>\`.`);
    return;
  }
  if (targetId === message.author.id) {
    await message.channel.send('Tu ne peux pas te suivre toi-même.');
    return;
  }

  const current = getFollowTarget(message.author.id);
  if (current === targetId) {
    clearFollow(message.author.id);
    await message.channel.send(`<a:1Kiss:1525528118352154674> Tu ne suis plus <@${targetId}>.`);
    return;
  }

  setFollow(message.author.id, targetId);
  await message.channel.send(`<a:bnyear_blue:1525583000031461436> Tu suis maintenant <@${targetId}> en vocal — relance \`${FOLLOW_PREFIX} ${targetId}\` pour arrêter.`);
}

/** &warn <id> <raison> : avertit un membre. */
async function handleWarn(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  const reason = parsed?.rest ?? '';
  if (!targetId || !reason) {
    await message.channel.send(`Usage : \`${WARN_PREFIX} <id ou @membre> <raison>\`.`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.channel.send('Ce membre est introuvable sur ce serveur.');
    return;
  }

  const modCheck = canModerate(message.guild, message.member, target);
  if (!modCheck.ok) return message.channel.send(modCheck.reason);

  const total = addWarn(message.guild.id, target.id, reason, message.author.id);
  await logModAction(message.guild, { action: 'warn', target, moderator: message.author, reason, extra: `Total d'avertissements : **${total}**` }).catch(() => {});
  await target.send({ content: `<:egirl:1526275509464469615> Tu as reçu un avertissement sur **${message.guild.name}** : ${reason}` }).catch(() => {});

  await message.channel.send(`<:egirl:1526275509464469615> <@${target.id}> a été averti.\n**Raison :** ${reason}\n**Total d'avertissements :** ${total}`);
}

/** &unwarn <id> [numéro] : retire le dernier avertissement, ou un numéro précis (voir &warn). */
async function handleUnwarn(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.channel.send(`Usage : \`${UNWARN_PREFIX} <id ou @membre> [numéro]\`.`);
    return;
  }

  const rest = parsed.rest;
  const numero = rest ? parseInt(rest, 10) : null;
  if (rest && (Number.isNaN(numero) || numero < 1)) {
    await message.channel.send(`Usage : \`${UNWARN_PREFIX} <id ou @membre> [numéro]\`.`);
    return;
  }

  const existing = getWarns(message.guild.id, targetId);
  if (existing.length === 0) {
    await message.channel.send(`<@${targetId}> n'a aucun avertissement.`);
    return;
  }

  const remaining = removeWarn(message.guild.id, targetId, numero ? numero - 1 : null);
  if (remaining === null) {
    await message.channel.send(`Avertissement n°${numero} introuvable (${existing.length} au total).`);
    return;
  }

  await logModAction(message.guild, { action: 'unwarn', target: { id: targetId }, moderator: message.author, extra: `Avertissements restants : **${remaining}**` }).catch(() => {});
  await message.channel.send(`<a:1Kiss:1525528118352154674> Avertissement retiré pour <@${targetId}> — il en reste **${remaining}**.`);
}

/** &wl <id> : bascule la liste blanche (protège des commandes de modération sur cette personne). */
async function handleWl(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.channel.send(`Usage : \`${WL_PREFIX} <id ou @membre>\`.`);
    return;
  }

  if (isWhitelisted(message.guild.id, targetId)) {
    removeFromWhitelist(message.guild.id, targetId);
    await message.channel.send(`<a:1Kiss:1525528118352154674> <@${targetId}> retiré de la liste blanche.`);
    return;
  }

  addToWhitelist(message.guild.id, targetId);
  await message.channel.send(`<a:1Kiss:1525528118352154674> <@${targetId}> ajouté à la liste blanche (protégé des commandes de modération).`);
}

/** &lock / &unlock : verrouille/déverrouille le salon où la commande est tapée. */
async function handleLock(message, lock) {
  if (!(await requireAdminMessage(message))) return;

  try {
    await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: lock ? false : null });
    await message.channel.send(lock ? `<a:hkhi:1525582949708468374> <#${message.channel.id}> est maintenant verrouillé.` : `<:ethereum:1526711837465378826> <#${message.channel.id}> est maintenant déverrouillé.`);
  } catch (err) {
    await message.channel.send(`Impossible de modifier ce salon : \`${err.message}\`.`);
  }
}

/**
 * &l0all : bascule le verrouillage global. Verrouille : ferme tous les salons
 * texte/annonces/forum (sauf ceux déjà fermés à @everyone) et mémorise
 * lesquels. Déverrouille : rouvre UNIQUEMENT ceux mémorisés (un salon déjà
 * privé avant le lockdown, comme le staff, reste donc privé après).
 */
async function handleL0all(message) {
  if (!(await requireAdminMessage(message))) return;

  const guild = message.guild;
  const everyone = guild.roles.everyone;
  const existing = getLockAll(guild.id);
  const unlocking = Boolean(existing);

  const status = await message.channel
    .send(unlocking ? '<:ethereum:1526711837465378826> Déverrouillage en cours...' : '<a:hkhi:1525582949708468374> Verrouillage en cours...')
    .catch(() => null);

  let done = 0;
  let failed = 0;

  if (unlocking) {
    for (const channelId of existing.channelIds) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue; // salon supprimé entre-temps
      try {
        await channel.permissionOverwrites.edit(everyone, { SendMessages: null });
        done++;
      } catch (err) {
        failed++;
        console.error(`[l0all] Déverrouillage impossible sur #${channel.name} :`, err.message);
      }
    }
    clearLockAll(guild.id);
  } else {
    const locked = [];
    for (const channel of guild.channels.cache.values()) {
      if (!LOCKALL_TYPES.includes(channel.type)) continue;

      const current = channel.permissionOverwrites.cache.get(everyone.id);
      if (current?.deny.has(PermissionFlagsBits.SendMessages)) continue; // déjà fermé, on n'y touche pas

      try {
        await channel.permissionOverwrites.edit(everyone, { SendMessages: false });
        locked.push(channel.id);
        done++;
      } catch (err) {
        failed++;
        console.error(`[l0all] Verrouillage impossible sur #${channel.name} :`, err.message);
      }
    }
    if (locked.length > 0) setLockAll(guild.id, { by: message.author.id, channelIds: locked });
  }

  const summary = unlocking
    ? `<:ethereum:1526711837465378826> **${done}** salon(s) déverrouillé(s).`
    : `<a:hkhi:1525582949708468374> **${done}** salon(s) verrouillé(s) — relance \`${L0ALL_PREFIX}\` pour tout rouvrir.`;
  const failNote = failed > 0 ? `\n<:egirl:1526275509464469615> ${failed} échec(s) (permissions manquantes ?).` : '';
  const nothing = done === 0 && failed === 0 ? '\n*Aucun salon concerné.*' : '';

  if (status) await status.edit(summary + failNote + nothing).catch(() => {});
  else await message.channel.send(summary + failNote + nothing).catch(() => {});
}

/** +ban <id> <raison> : bannit un membre du serveur. */
async function handleBan(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.channel.send(`Usage : \`${BAN_PREFIX} <id ou @membre> [raison]\`.`);
    return;
  }
  const reason = parsed.rest || null;

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (target) {
    const modCheck = canModerate(message.guild, message.member, target);
    if (!modCheck.ok) return message.channel.send(modCheck.reason);
    if (!target.bannable) return message.channel.send("Le bot n'a pas la permission de bannir ce membre.");
    await target.send({ content: `<a:ableh:1525532035928690688> Tu as été banni de **${message.guild.name}**.${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});
  }

  try {
    await message.guild.members.ban(targetId, { reason: reason ?? undefined });
  } catch (err) {
    await message.channel.send(`Impossible de bannir ce membre : \`${err.message}\`.`);
    return;
  }

  await logModAction(message.guild, { action: 'ban', target: { id: targetId }, moderator: message.author, reason }).catch(() => {});
  await message.channel.send(`<a:ableh:1525532035928690688> <@${targetId}> a été banni.` + (reason ? `\n**Raison :** ${reason}` : ''));
}

/** +unban <id> [raison] : débannit un membre (par ID). */
async function handleUnban(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.channel.send(`Usage : \`${UNBAN_PREFIX} <id> [raison]\`.`);
    return;
  }
  const reason = parsed.rest || null;

  const ban = await message.guild.bans.fetch(targetId).catch(() => null);
  if (!ban) {
    await message.channel.send("Cet ID n'est pas banni sur ce serveur.");
    return;
  }

  try {
    await message.guild.members.unban(targetId, reason ?? undefined);
  } catch (err) {
    await message.channel.send(`Impossible de débannir : \`${err.message}\`.`);
    return;
  }

  await logModAction(message.guild, { action: 'unban', target: { id: targetId }, moderator: message.author, reason }).catch(() => {});
  await message.channel.send(`<a:1Kiss:1525528118352154674> <@${targetId}> a été débanni.` + (reason ? `\n**Raison :** ${reason}` : ''));
}

/** Supprime tous les messages du salon envoyés dans la fenêtre de temps donnée (5 lots de 100 max). */
async function clearRecentMessages(channel, sinceMs) {
  let totalDeleted = 0;

  for (let i = 0; i < 5; i++) {
    const batch = await channel.messages.fetch({ limit: 100 });
    const toDelete = batch.filter((m) => m.createdTimestamp >= sinceMs);
    if (toDelete.size === 0) break;

    const deleted = await channel.bulkDelete(toDelete, true);
    totalDeleted += deleted.size;

    if (toDelete.size < batch.size) break; // plus aucun message dans la fenêtre au-delà de ce lot
  }

  return totalDeleted;
}

/**
 * Supprime les `count` messages précédant la commande (par lots de 100 max,
 * limite Discord) — le message `&clear <n>` lui-même est TOUJOURS supprimé
 * en plus, mais jamais compté dans le total retourné.
 */
async function clearMessageCount(channel, count) {
  let remaining = count + 1;
  let totalDeleted = 0;

  while (remaining > 0) {
    const batchSize = Math.min(100, remaining);
    const deleted = await channel.bulkDelete(batchSize, true);
    totalDeleted += deleted.size;
    remaining -= batchSize;
    if (deleted.size < batchSize) break; // plus rien à supprimer
  }

  return Math.max(0, totalDeleted - 1);
}

const CLEAR_WINDOW_MS = 67 * 60 * 1000;
const CLEAR_MAX_COUNT = 1000;

/** &clear [nombre] : sans argument, supprime les messages des 67 dernières minutes ; avec un nombre, supprime ce nombre de messages (max 1000). */
async function handleClear(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsedCount = Number(rawArgs);
  const useCount = rawArgs !== '' && Number.isInteger(parsedCount) && parsedCount > 0;

  if (rawArgs !== '' && !useCount) {
    await message.channel.send(`Usage : \`${CLEAR_PREFIX}\` (67 dernières minutes) ou \`${CLEAR_PREFIX} <nombre>\`.`);
    return;
  }

  try {
    const deletedCount = useCount
      ? await clearMessageCount(message.channel, Math.min(parsedCount, CLEAR_MAX_COUNT))
      : await clearRecentMessages(message.channel, Date.now() - CLEAR_WINDOW_MS);

    const confirmation = await message.channel.send(`<a:1Kiss:1525528118352154674> ${deletedCount} message(s) supprimé(s).`);
    setTimeout(() => confirmation.delete().catch(() => {}), 5000);
  } catch (err) {
    await message.channel.send(`Impossible de supprimer ces messages : \`${err.message}\`.`);
  }
}

/** &purge <id> [nombre] : supprime les messages d'un membre parmi les derniers messages du salon. */
async function handlePurge(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.channel.send(`Usage : \`${PURGE_PREFIX} <id ou @membre> [nombre]\`.`);
    return;
  }

  const scanLimit = parsed.rest ? parseInt(parsed.rest, 10) : 100;
  if (Number.isNaN(scanLimit) || scanLimit < 1) {
    await message.channel.send(`Usage : \`${PURGE_PREFIX} <id ou @membre> [nombre]\`.`);
    return;
  }

  try {
    const fetched = await message.channel.messages.fetch({ limit: Math.min(scanLimit, 100) });
    const toDelete = fetched.filter((m) => m.author.id === targetId);

    if (toDelete.size === 0) {
      await message.channel.send(`Aucun message de <@${targetId}> trouvé parmi les ${Math.min(scanLimit, 100)} derniers.`);
      return;
    }

    const deleted = await message.channel.bulkDelete(toDelete, true);
    const confirmation = await message.channel.send(`<a:1Kiss:1525528118352154674> ${deleted.size} message(s) de <@${targetId}> supprimé(s).`);
    setTimeout(() => confirmation.delete().catch(() => {}), 5000);
  } catch (err) {
    await message.channel.send(`Impossible de supprimer ces messages : \`${err.message}\`.`);
  }
}

/** &bl <id> [raison] : bannit un membre et le blackliste (re-banni automatiquement s'il tente de revenir). */
async function handleBl(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.channel.send(`Usage : \`${BL_PREFIX} <id ou @membre> [raison]\`.`);
    return;
  }
  const reason = parsed.rest || null;

  if (isBlacklisted(message.guild.id, targetId)) {
    await message.channel.send(`<@${targetId}> est déjà sur la liste noire.`);
    return;
  }
  if (isWhitelisted(message.guild.id, targetId)) {
    await message.channel.send(`<@${targetId}> est sur la liste blanche — protégé du blacklist (voir \`${WL_PREFIX}\`).`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (target) {
    const modCheck = canModerate(message.guild, message.member, target);
    if (!modCheck.ok) return message.channel.send(modCheck.reason);
    if (!target.bannable) return message.channel.send("Le bot n'a pas la permission de bannir ce membre.");
    await target.send({ content: `<:PayPal:1526628472984965280> Tu as été blacklisté sur **${message.guild.name}**.${reason ? `\nRaison : ${reason}` : ''}` }).catch(() => {});
  }

  try {
    await message.guild.members.ban(targetId, { reason: `Blacklist : ${reason ?? 'aucune raison'}` });
  } catch (err) {
    await message.channel.send(`Impossible de bannir ce membre : \`${err.message}\`.`);
    return;
  }

  addToBlacklist(message.guild.id, targetId);
  await logModAction(message.guild, { action: 'blacklist', target: { id: targetId }, moderator: message.author, reason }).catch(() => {});
  await message.channel.send(`<:PayPal:1526628472984965280> <@${targetId}> a été banni et blacklisté.` + (reason ? `\n**Raison :** ${reason}` : ''));
}

/** &unbl <id> [raison] : retire un membre de la liste noire (ne le débannit pas automatiquement, voir +unban). */
async function handleUnbl(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const parsed = extractLeadingTarget(rawArgs);
  const targetId = parsed?.id;
  if (!targetId) {
    await message.channel.send(`Usage : \`${UNBL_PREFIX} <id> [raison]\`.`);
    return;
  }
  const reason = parsed.rest || null;

  if (!isBlacklisted(message.guild.id, targetId)) {
    await message.channel.send(`<@${targetId}> n'est pas sur la liste noire.`);
    return;
  }

  removeFromBlacklist(message.guild.id, targetId);
  await logModAction(message.guild, { action: 'unblacklist', target: { id: targetId }, moderator: message.author, reason }).catch(() => {});
  await message.channel.send(`<a:1Kiss:1525528118352154674> <@${targetId}> retiré de la liste noire (le débannissement du serveur, si besoin, se fait séparément avec \`${UNBAN_PREFIX}\`).`);
}

/** &muet <id> : bascule le mute vocal serveur (coupe/réactive le micro). */
async function handleMuet(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.channel.send(`Usage : \`${MUET_PREFIX} <id ou @membre>\`.`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.channel.send('Ce membre est introuvable sur ce serveur.');
    return;
  }
  if (!target.voice.channel) {
    await message.channel.send(`<@${target.id}> n'est pas en vocal.`);
    return;
  }

  const modCheck = canModerate(message.guild, message.member, target);
  if (!modCheck.ok) return message.channel.send(modCheck.reason);

  const nowMuted = !target.voice.mute;
  try {
    await target.voice.setMute(nowMuted, `${nowMuted ? 'Coupé' : 'Réactivé'} par ${message.author.tag}`);
  } catch (err) {
    await message.channel.send(`Impossible de modifier le micro : \`${err.message}\`.`);
    return;
  }

  await logModAction(message.guild, { action: nowMuted ? 'voicemute' : 'voiceunmute', target, moderator: message.author }).catch(() => {});
  await message.channel.send(
    nowMuted
      ? `<:whitestar:1525583692754321478> Micro de <@${target.id}> coupé en vocal.`
      : `<a:bnyear_black:1525582808116891798> Micro de <@${target.id}> réactivé en vocal.`
  );
}

/** &sourd <id> : bascule la surdité vocale serveur. */
async function handleSourd(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.channel.send(`Usage : \`${SOURD_PREFIX} <id ou @membre>\`.`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.channel.send('Ce membre est introuvable sur ce serveur.');
    return;
  }
  if (!target.voice.channel) {
    await message.channel.send(`<@${target.id}> n'est pas en vocal.`);
    return;
  }

  const modCheck = canModerate(message.guild, message.member, target);
  if (!modCheck.ok) return message.channel.send(modCheck.reason);

  const nowDeaf = !target.voice.deaf;
  try {
    await target.voice.setDeaf(nowDeaf, `${nowDeaf ? 'Rendu sourd' : 'Surdité retirée'} par ${message.author.tag}`);
  } catch (err) {
    await message.channel.send(`Impossible de modifier la surdité : \`${err.message}\`.`);
    return;
  }

  await logModAction(message.guild, { action: nowDeaf ? 'voicedeafen' : 'voiceundeafen', target, moderator: message.author }).catch(() => {});
  await message.channel.send(
    nowDeaf
      ? `<:whitestar:1525583692754321478> <@${target.id}> est maintenant sourd en vocal.`
      : `<a:bnyear_black:1525582808116891798> <@${target.id}> n'est plus sourd en vocal.`
  );
}

/** &channel : affiche un menu (embed + boutons) pour gérer les salons. */
async function handleChannelMenu(message) {
  if (!(await requireAdminMessage(message))) return;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Gestion des salons')
    .setDescription('Choisis une action ci-dessous. Toutes agissent sur **ce salon**, sauf "Créer" qui en crée un nouveau.');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('nc_channel:create').setLabel('Créer').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('nc_channel:rename').setLabel('Renommer').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('nc_channel:hide').setLabel('Masquer').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('nc_channel:unhide').setLabel('Afficher').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('nc_channel:delete').setLabel('Supprimer').setStyle(ButtonStyle.Danger)
  );

  await message.channel.send({ embeds: [embed], components: [row] });
}

/** Clic sur un bouton du menu &channel : ouvre un modal (créer/renommer) ou agit directement (masquer/afficher/supprimer). */
async function handleChannelButton(interaction) {
  if (!(await requireAdmin(interaction))) return;

  const action = interaction.customId.split(':')[1];

  if (action === 'create') {
    const modal = new ModalBuilder().setCustomId('nc_channel_modal:create').setTitle('Créer un salon');
    const nameInput = new TextInputBuilder().setCustomId('nom').setLabel('Nom du salon').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    return interaction.showModal(modal);
  }

  if (action === 'rename') {
    const modal = new ModalBuilder().setCustomId('nc_channel_modal:rename').setTitle('Renommer ce salon');
    const nameInput = new TextInputBuilder().setCustomId('nouveau_nom').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
    return interaction.showModal(modal);
  }

  if (action === 'delete') {
    const channel = interaction.channel;
    const name = channel.name;
    await interaction.reply({ content: `Salon **${name}** supprimé.`, ephemeral: true });
    try {
      await channel.delete(`Supprimé par ${interaction.user.tag}`);
    } catch (err) {
      await interaction.followUp({ content: `Impossible de supprimer ce salon : \`${err.message}\`.`, ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (action === 'hide') {
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
      await interaction.deferUpdate().catch(() => {});
      await interaction.channel.send(`<a:FakeNitroEmoji:1525583069996650560> <#${interaction.channel.id}> est maintenant masqué pour @everyone.`);
    } catch (err) {
      await interaction.reply({ content: `Impossible de masquer ce salon : \`${err.message}\`.`, ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (action === 'unhide') {
    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
      await interaction.deferUpdate().catch(() => {});
      await interaction.channel.send(`<:hkexc:1525532083366137917> <#${interaction.channel.id}> est de nouveau visible pour @everyone.`);
    } catch (err) {
      await interaction.reply({ content: `Impossible de rendre ce salon visible : \`${err.message}\`.`, ephemeral: true }).catch(() => {});
    }
  }
}

/** Soumission d'un modal &channel (création ou renommage). */
async function handleChannelModal(interaction) {
  if (!(await requireAdmin(interaction))) return;

  const action = interaction.customId.split(':')[1];

  if (action === 'create') {
    const name = interaction.fields.getTextInputValue('nom');
    try {
      const channel = await interaction.guild.channels.create({ name, type: ChannelType.GuildText, reason: `Créé par ${interaction.user.tag}` });
      await interaction.deferUpdate().catch(() => {});
      await interaction.channel.send(`<a:1Kiss:1525528118352154674> Salon <#${channel.id}> créé.`);
    } catch (err) {
      await interaction.reply({ content: `Impossible de créer ce salon : \`${err.message}\`.`, ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (action === 'rename') {
    const newName = interaction.fields.getTextInputValue('nouveau_nom');
    const channel = interaction.channel;
    const oldName = channel.name;
    try {
      await channel.setName(newName, `Renommé par ${interaction.user.tag}`);
      await interaction.deferUpdate().catch(() => {});
      await interaction.channel.send(`<a:1Kiss:1525528118352154674> Salon **${oldName}** renommé en **${newName}**.`);
    } catch (err) {
      await interaction.reply({ content: `Impossible de renommer ce salon : \`${err.message}\`.`, ephemeral: true }).catch(() => {});
    }
  }
}

/** =link <id/@rôle> <id/@rôle> [id/@rôle] [id/@rôle] : lie 2 à 4 rôles ensemble (voir handleLinkedRoles). */
async function handleLink(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const roleIds = [...new Set(rawArgs.match(/\d{17,20}/g) ?? [])];
  if (roleIds.length < 2 || roleIds.length > 4) {
    await message.channel.send(`Usage : \`${LINK_PREFIX} <id/@rôle> <id/@rôle> [id/@rôle] [id/@rôle]\` (2 à 4 rôles).`);
    return;
  }

  const roles = [];
  for (const id of roleIds) {
    const role = message.guild.roles.cache.get(id);
    if (!role) {
      await message.channel.send(`Rôle introuvable : \`${id}\`.`);
      return;
    }
    roles.push(role);
  }

  addLinkedGroup(message.guild.id, roleIds);
  await message.channel.send(
    `<a:1Kiss:1525528118352154674> Rôles liés : ${roles.map((r) => `<@&${r.id}>`).join(', ')} — en attribuer un attribue les autres ; un admin bot qui en retire un retire les autres.`
  );
}

/** =s&p [#salon] : bascule la soumission de photos par MP (voir listeners messageCreate/interactionCreate). */
async function handleSp(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const channelMatch = rawArgs.match(/<#(\d+)>/);
  const currentId = getSpChannelId(message.guild.id);

  if (!channelMatch) {
    await message.channel.send(
      currentId
        ? `Soumission photo activée sur ce serveur — salon : <#${currentId}>.`
        : `Soumission photo désactivée ici. Usage : \`${SP_PREFIX} #salon\` (relance sur le même salon pour désactiver).`
    );
    return;
  }

  const channelId = channelMatch[1];
  if (currentId === channelId) {
    disableSp(message.guild.id);
    await message.channel.send(`<a:1Kiss:1525528118352154674> Soumission photo désactivée (<#${channelId}> ne recevra plus les soumissions).`);
    return;
  }

  setSpChannel(message.guild.id, channelId);
  await message.channel.send(
    currentId
      ? `<a:1Kiss:1525528118352154674> Salon de soumission déplacé de <#${currentId}> vers <#${channelId}>.`
      : `<a:1Kiss:1525528118352154674> Soumission photo activée — les photos reçues en MP seront postées dans <#${channelId}>.`
  );
}

/** Clic sur un bouton de soumission photo : choix du serveur, puis Homme/Femme. */
async function handleSpButton(interaction) {
  const [, token, action, guildId] = interaction.customId.split(':');
  const pending = pendingPhotoSubmissions.get(token);
  if (!pending) {
    await interaction.reply({ content: 'Cette soumission a expiré, renvoie ta photo.', ephemeral: true });
    return;
  }

  // Première étape (plusieurs serveurs possibles) : on a choisi le serveur,
  // on propose maintenant la catégorie.
  if (action === 'guild') {
    await interaction.update(buildSpGenderPrompt(token, guildId, pending.imageUrl)).catch(() => {});
    return;
  }

  const channelId = getSpChannelId(guildId);
  if (!channelId) {
    await interaction.reply({ content: "La soumission de photos n'est plus activée sur ce serveur.", ephemeral: true });
    return;
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  const channel = guild ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!channel) {
    await interaction.reply({ content: 'Le salon configuré est introuvable.', ephemeral: true });
    return;
  }

  pendingPhotoSubmissions.delete(token);

  const genderLabel = action === 'male' ? 'Homme' : 'Femme';
  const embed = new EmbedBuilder()
    .setColor(action === 'male' ? 0x3498db : 0xe91e63)
    .setDescription(`**${genderLabel}** — envoyé par <@${pending.authorId}>`)
    .setImage(pending.imageUrl);

  const posted = await channel.send({ embeds: [embed] }).catch(() => null);
  if (posted) {
    await posted.react('✅').catch(() => {});
    await posted.react('🚫').catch(() => {});
    await posted.startThread({ name: pending.authorTag.slice(0, 100), autoArchiveDuration: 1440 }).catch(() => {});
  }

  await interaction
    .update({ content: `<a:1Kiss:1525528118352154674> Photo envoyée sur **${guild.name}** !`, embeds: [], components: [] })
    .catch(() => {});
}

/** =automod : active/désactive la suppression automatique des mots interdits. */
async function handleAutomod(message) {
  if (!(await requireAdminMessage(message))) return;

  const { enabled, words, seeded } = automod.toggleEnabled(message.guild.id);

  if (!enabled) {
    await message.channel.send('<a:1Kiss:1525528118352154674> Automod **désactivé**.');
    return;
  }

  await message.channel.send(
    `<a:1Kiss:1525528118352154674> Automod **activé** — ${words.length} mot(s) filtré(s)` +
      (seeded ? ' (liste de base installée : insultes racistes, homophobes et violences sexuelles).' : '.') +
      `\nVoir la liste : \`${MOD_PREFIX}\` · Ajouter/retirer : \`${MOD_PREFIX} <mot>\``
  );
}

/** =mod <mot> : ajoute (ou retire) un mot interdit, un seul à la fois. Sans argument : la liste. */
async function handleMod(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const { enabled, words } = automod.getConfig(message.guild.id);

  if (!rawArgs) {
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle(`🛑 Mots interdits (${words.length})`)
      .setDescription(words.length ? words.map((w) => `\`${w}\``).join(' · ') : '*Aucun mot pour le moment.*')
      .setFooter({ text: enabled ? 'Automod actif' : `Automod inactif — active-le avec ${AUTOMOD_PREFIX}` });
    await message.channel.send({ embeds: [embed] });
    return;
  }

  if (/\s/.test(rawArgs.trim())) {
    await message.channel.send(`Un seul mot à la fois : \`${MOD_PREFIX} <mot>\`.`);
    return;
  }

  const { added, word } = automod.toggleWord(message.guild.id, rawArgs.trim());
  if (!word) {
    await message.channel.send('Ce mot ne contient aucune lettre exploitable.');
    return;
  }

  await message.channel.send(
    added
      ? `<a:1Kiss:1525528118352154674> \`${word}\` ajouté aux mots interdits (dérivés et contournements compris).${enabled ? '' : `\n*Pense à activer l'automod avec \`${AUTOMOD_PREFIX}\`.*`}`
      : `<a:1Kiss:1525528118352154674> \`${word}\` retiré des mots interdits.`
  );
}

/** =menotte <id> : bascule la menotte — la cible est ramenée dans son salon vocal si elle bouge. */
async function handleMenotte(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.channel.send(`Usage : \`${MENOTTE_PREFIX} <id ou @membre>\`.`);
    return;
  }

  if (removeHandcuff(targetId)) {
    await message.channel.send(`<a:1Kiss:1525528118352154674> <@${targetId}> n'est plus menotté(e).`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.channel.send('Ce membre est introuvable sur ce serveur.');
    return;
  }

  const modCheck = canModerate(message.guild, message.member, target);
  if (!modCheck.ok) return message.channel.send(modCheck.reason);

  if (!target.voice.channelId) {
    await message.channel.send(`<@${targetId}> doit être en vocal pour être menotté(e).`);
    return;
  }

  setHandcuff(targetId, { holderId: message.author.id, channelId: target.voice.channelId, guildId: message.guild.id });
  await message.channel.send(
    `<:argent:1525538360322687097> <@${targetId}> est menotté(e) dans **${target.voice.channel.name}** — il/elle y sera ramené(e) à chaque tentative de changement, jusqu'à ce qu'un admin relance \`${MENOTTE_PREFIX} ${targetId}\`.`
  );
}

const UI_STATUS = {
  online: { emoji: '🟢', label: 'En ligne' },
  idle: { emoji: '🟠', label: 'Inactif' },
  dnd: { emoji: '🔴', label: 'Ne pas déranger' },
  offline: { emoji: '⚫', label: 'Hors ligne' },
};

/** =ui [id] : fiche d'informations d'un membre (soi-même par défaut). */
async function handleUi(message, rawTarget) {
  const targetId = extractId(rawTarget) ?? message.author.id;

  const member = await message.guild.members.fetch({ user: targetId, force: true }).catch(() => null);
  if (!member) {
    await message.channel.send('Membre introuvable sur ce serveur.');
    return;
  }

  const user = member.user;
  const status = member.presence?.status ?? 'offline';
  const { emoji, label } = UI_STATUS[status] ?? UI_STATUS.offline;

  const roles = member.roles.cache
    .filter((role) => role.id !== message.guild.id)
    .sort((a, b) => b.position - a.position)
    .map((role) => `<@&${role.id}>`);

  const createdTs = Math.floor(user.createdTimestamp / 1000);
  const joinedTs = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

  const embed = new EmbedBuilder()
    .setColor(member.displayColor || 0x9b59b6)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: 'Membre', value: `<@${user.id}>\n\`${user.id}\``, inline: true },
      { name: 'Statut', value: `${emoji} ${label}`, inline: true },
      { name: 'Vocal', value: member.voice.channel ? `<#${member.voice.channel.id}>` : 'Pas en vocal', inline: true },
      {
        name: 'Dates',
        value: `Compte créé : <t:${createdTs}:D> (<t:${createdTs}:R>)\n${joinedTs ? `A rejoint : <t:${joinedTs}:D> (<t:${joinedTs}:R>)` : 'A rejoint : inconnu'}`,
      },
      { name: `Rôles (${roles.length})`, value: roles.length ? roles.slice(0, 25).join(' ') : 'Aucun rôle' }
    );

  await message.channel.send({ embeds: [embed] });
}

/** =ticket : poste le panneau (embed + 3 boutons) pour ouvrir un ticket. */
/** Rend un emoji { id, name, animated } sous sa forme texte `<a:nom:id>`. */
function formatEmoji(emoji) {
  return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

async function handleTicketPanel(message) {
  if (!(await requireAdminMessage(message))) return;

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setDescription(
      '<a:Wcrown:1528368212528336946> **__TICKET PV POUR LE MEILLEUR SERVEUR PV__ !**\n\n' +
        '> <a:arrow_pretty:1526711980059136021> Tu as besoin de renseignement ? ( Contacte les Admin )\n\n' +
        '> <a:arrow_pretty:1526711980059136021> Tu souhaite contribuer / fusionner afin d\'aider au développement ? ( Partenariat )\n\n' +
        '> <a:arrow_pretty:1526711980059136021> Ou bien tu souhaite te plaindre d\'un abus ! ( Abus )\n\n' +
        '<a:hkhi:1525582949708468374> **Pousse la bonne porte ci-dessous et l\'équipe s\'occupe de toi.**'
    );

  const row = new ActionRowBuilder().addComponents(
    TICKET_CATEGORIES.map((c) =>
      new ButtonBuilder().setCustomId(`nc_ticket:${c.value}`).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Secondary)
    )
  );

  await message.channel.send({ embeds: [embed], components: [row] });
}

/** Clic sur une catégorie du panneau =ticket : crée un salon privé pour ce ticket. */
async function handleTicketButton(interaction) {
  const category = TICKET_CATEGORIES.find((c) => c.value === interaction.customId.split(':')[1]);
  if (!category) return;

  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;
  if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply("Le bot n'a pas la permission de créer des salons.");
    return;
  }

  let ticketCategory = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('ticket'));
  if (!ticketCategory) {
    ticketCategory = await guild.channels.create({ name: TICKET_CATEGORY_NAME, type: ChannelType.GuildCategory }).catch(() => null);
  }

  const adminRole = guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'membre';
  let channelName = `${category.prefix}-${safeName}`;
  if (guild.channels.cache.some((c) => c.name === channelName)) {
    channelName += `-${Math.random().toString(36).slice(2, 5)}`;
  }

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    {
      id: guild.members.me.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
    },
  ];
  if (adminRole) {
    overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const channel = await guild.channels
    .create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: ticketCategory?.id,
      topic: `Ticket ouvert par ${interaction.user.id} | catégorie : ${category.value}`,
      permissionOverwrites: overwrites,
    })
    .catch(() => null);

  if (!channel) {
    await interaction.editReply('Impossible de créer le salon du ticket.');
    return;
  }

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('Bienvenue au salon privé')
    .setDescription(
      `${formatEmoji(category.emoji)} **${category.label}**\n` +
        "Explique-nous tout ici, un membre de l'équipe arrive vite. Une fois réglé, ferme ce salon avec le bouton ci-dessous."
    );
  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('nc_ticket_close').setLabel('Fermer le ticket').setStyle(ButtonStyle.Danger)
  );
  await channel.send({ content: `<@${interaction.user.id}>`, embeds: [welcomeEmbed], components: [closeRow] });

  await interaction.editReply(`Ticket créé : <#${channel.id}>`);
}

/** Clic sur "Fermer le ticket" : journalise puis supprime le salon. */
async function handleTicketClose(interaction) {
  // Accusé de réception silencieux : le message visible part du salon, pour
  // que les emojis personnalisés s'affichent (voir data/respond.js).
  await interaction.deferUpdate().catch(() => {});
  await interaction.channel.send('<a:1Kiss:1525528118352154674> Fermeture du ticket en cours...').catch(() => {});

  const topic = interaction.channel.topic ?? '';
  const openerMatch = topic.match(/(\d{17,20})/);
  const openerId = openerMatch ? openerMatch[1] : null;

  await logEvent(interaction.guild, {
    title: 'Ticket fermé',
    color: 0xff6600,
    description: `**Salon :** ${interaction.channel.name}\n**Ouvert par :** ${openerId ? `<@${openerId}>` : 'inconnu'}\n**Fermé par :** <@${interaction.user.id}>`,
  }).catch(() => {});

  setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
}

/** +snipe [#salon] : affiche le dernier message supprimé de ce salon (ou du salon mentionné). */
async function handleSnipe(message, rawArgs) {
  if (!(await requireAdminMessage(message))) return;

  const channelMatch = rawArgs.match(/<#(\d+)>/);
  const channel = channelMatch ? await message.guild.channels.fetch(channelMatch[1]).catch(() => null) : message.channel;
  if (!channel) {
    await message.channel.send('Salon introuvable.');
    return;
  }

  const entry = getDeleted(channel.id);
  if (!entry) {
    await message.channel.send(`Aucun message supprimé récemment dans <#${channel.id}>.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xff6600)
    .setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatarURL ?? undefined })
    .setDescription(entry.content || '*(aucun texte — probablement une image/embed)*')
    .setFooter({ text: `Supprimé dans #${channel.name}` })
    .setTimestamp(entry.at);

  if (entry.imageURL) embed.setImage(entry.imageURL);

  await message.channel.send({ embeds: [embed] });
}

/** =admin / =addmin <id> : bascule le rôle Admin (ajoute si absent, retire si déjà présent). Sans id : liste les admins. */
async function handleAddmin(message, rawTarget) {
  if (!(await requireAdminMessage(message))) return;
  if (!rawTarget) return handleAdminList(message);

  const targetId = extractId(rawTarget);
  if (!targetId) {
    await message.channel.send(`Usage : \`${ADMIN_PREFIX} <id ou @membre>\` (sans id : liste des admins).`);
    return;
  }

  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) {
    await message.channel.send('Ce membre est introuvable sur ce serveur.');
    return;
  }

  let role = message.guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
  if (!role) {
    if (message.guild.members.me.roles.highest.position <= 0) {
      await message.channel.send("Le bot n'a pas de rôle assez haut pour créer le rôle Admin.");
      return;
    }
    role = await message.guild.roles.create({
      name: ADMIN_ROLE_NAME,
      permissions: [PermissionFlagsBits.Administrator],
      reason: `Rôle Admin créé automatiquement par ${message.author.tag}`,
    });
  }

  if (target.roles.cache.has(role.id)) {
    try {
      await target.roles.remove(role, `Admin retiré par ${message.author.tag}`);
      await message.channel.send(`<a:1Kiss:1525528118352154674> <@${target.id}> n'a plus le rôle Admin.`);
    } catch (err) {
      await message.channel.send(`Impossible de retirer le rôle Admin : \`${err.message}\`.`);
    }
    return;
  }

  try {
    await target.roles.add(role, `Admin donné par ${message.author.tag}`);
    await message.channel.send(`<a:1Kiss:1525528118352154674> <@${target.id}> a maintenant le rôle Admin.`);
  } catch (err) {
    await message.channel.send(`Impossible de donner le rôle Admin : \`${err.message}\`.`);
  }
}

/** =admin : liste tous les membres ayant le rôle Admin. */
async function handleAdminList(message) {
  if (!(await requireAdminMessage(message))) return;

  const role = message.guild.roles.cache.find((r) => r.name === ADMIN_ROLE_NAME);
  if (!role) {
    await message.channel.send(`Aucun rôle **${ADMIN_ROLE_NAME}** n'existe encore — donne-le à quelqu'un avec \`${ADMIN_PREFIX} <id>\`.`);
    return;
  }

  // role.members ne lit que le cache : sans ce fetch, la liste est vide tant
  // que les membres n'ont pas été chargés (cause du "aucun membre" à tort).
  await message.guild.members.fetch().catch(() => {});

  const members = [...role.members.values()];
  if (members.length === 0) {
    await message.channel.send(`Personne n'a le rôle **${ADMIN_ROLE_NAME}** pour le moment.`);
    return;
  }

  const lines = members.map((m) => `<@${m.id}> — \`${m.id}\``);
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`👑 Admins du serveur (${members.length})`)
    .setDescription(lines.join('\n'));
  await message.channel.send({ embeds: [embed] });
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
