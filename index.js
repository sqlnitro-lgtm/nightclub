/**
 * index.js
 * ------------------------------------------------------------------
 * Point d'entrée du bot Discord.
 * - Charge dynamiquement toutes les commandes du dossier /commands.
 * ------------------------------------------------------------------
 */

require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
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

client.login(process.env.DISCORD_TOKEN);
