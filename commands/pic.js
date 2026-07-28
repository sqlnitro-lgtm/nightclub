const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const { respondPlain } = require('../data/respond');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pic')
    .setDescription("Affiche la photo de profil d'un membre")
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné (défaut : toi)').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('membre') ?? interaction.user;

    // force: true contourne le cache — sinon un avatar changé récemment
    // ressort avec l'ancienne image.
    const fetched = await interaction.client.users.fetch(user.id, { force: true }).catch(() => user);
    const url = fetched.displayAvatarURL({ size: 1024 });

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setAuthor({ name: fetched.tag, iconURL: url })
      .setImage(url);

    await respondPlain(interaction, { embeds: [embed] });
  },
};
