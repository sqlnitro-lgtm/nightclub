/**
 * deploy-commands.js
 * ------------------------------------------------------------------
 * Enregistre les slash commands auprès de Discord.
 *
 * - Si GUILD_ID est défini dans le .env : déploiement instantané sur
 *   ce serveur uniquement (idéal en développement).
 * - Sinon : déploiement global (peut prendre jusqu'à 1h à se propager,
 *   mais fonctionne aussi en message privé).
 *
 * Usage : node deploy-commands.js
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

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
  try {
    console.log(`🔄 Déploiement de ${commands.length} commande(s)...`);

    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    const data = await rest.put(route, { body: commands });

    console.log(
      `✅ ${data.length} commande(s) déployée(s) ${
        GUILD_ID ? `sur le serveur ${GUILD_ID}` : "globalement (jusqu'à 1h de propagation)"
      }.`
    );
  } catch (err) {
    console.error('❌ Erreur lors du déploiement des commandes :', err);
  }
})();
