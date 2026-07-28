/**
 * deploy-commands.js
 * ------------------------------------------------------------------
 * Enregistre les slash commands sur TOUS les serveurs autorisés
 * (data/approvedGuilds.json — voir =ticket/approbation dans index.js).
 *
 * Le déploiement par serveur est INSTANTANÉ, là où un déploiement global
 * met jusqu'à 1h à se propager. Les commandes globales sont effacées au
 * passage : sinon elles feraient doublon avec celles des serveurs.
 *
 * Un serveur approuvé plus tard reçoit ses commandes automatiquement au
 * moment de l'approbation (voir deployCommandsToGuild dans index.js) ; il
 * n'y a donc pas besoin de relancer ce script à chaque nouveau serveur.
 *
 * Usage : node deploy-commands.js
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { loadApprovedGuilds } = require('./data/approvedGuildsStore');

const { DISCORD_TOKEN, CLIENT_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN et CLIENT_ID doivent être définis dans le fichier .env');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  const guildIds = loadApprovedGuilds();

  if (guildIds.length === 0) {
    console.warn("⚠️  Aucun serveur autorisé dans data/approvedGuilds.json — rien à déployer.");
    return;
  }

  // Les commandes globales feraient doublon avec les commandes par serveur.
  const globals = await rest.get(Routes.applicationCommands(CLIENT_ID)).catch(() => []);
  if (globals.length > 0) {
    console.log(`🧹 Suppression de ${globals.length} commande(s) globale(s) (évite les doublons)...`);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }).catch((err) => {
      console.error('   Échec du nettoyage global :', err.message);
    });
  }

  console.log(`🔄 Déploiement de ${commands.length} commande(s) sur ${guildIds.length} serveur(s) autorisé(s)...`);

  let ok = 0;
  for (const guildId of guildIds) {
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: commands });
      console.log(`   ✅ ${guildId}`);
      ok++;
    } catch (err) {
      // Typiquement : le bot n'est plus sur ce serveur, ou il y a été invité
      // sans le scope applications.commands.
      console.error(`   ❌ ${guildId} — ${err.message}`);
    }
  }

  console.log(`\n✅ ${ok}/${guildIds.length} serveur(s) à jour (effet immédiat).`);
})();
