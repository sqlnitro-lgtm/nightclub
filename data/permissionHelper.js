/**
 * permissionHelper.js - toutes les commandes de modération sont
 * réservées aux Administrateurs (rôle donné via /giveadmin, qui accorde
 * la permission Discord Administrator) — le propriétaire du bot
 * (data/ownerStore.js) contourne toujours cette vérification, même sans
 * le rôle, sur n'importe quel serveur.
 */
const { PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('./ownerStore');

/** Répond et retourne false si refusé ; ne répond rien et retourne true si autorisé. */
async function requireAdmin(interaction) {
  if (isOwner(interaction.user.id)) return true;
  if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  await interaction.reply({ content: "Cette commande est réservée aux administrateurs (voir /giveadmin).", ephemeral: true });
  return false;
}

module.exports = { requireAdmin };
