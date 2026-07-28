/**
 * respond.js - envoie la réponse "réelle" d'une commande slash comme un
 * message normal du salon, pas comme une réponse d'interaction (qui affiche
 * la bannière "a utilisé /commande" au-dessus). Accuse réception en
 * silence (éphémère, invisible pour les autres) puis envoie le contenu via
 * un message classique du salon.
 */
async function respondPlain(interaction, payload) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
  }
  await interaction.channel.send(payload).catch(() => {});
  await interaction.deleteReply().catch(() => {});
}

module.exports = { respondPlain };
