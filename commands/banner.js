const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const { respondPlain } = require('../data/respond');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription("Affiche la bannière d'un membre")
    .setContexts([InteractionContextType.Guild])
    .addUserOption((opt) => opt.setName('membre').setDescription('Le membre concerné (défaut : toi)').setRequired(false)),

  async execute(interaction) {
    const user = interaction.options.getUser('membre') ?? interaction.user;

    // La bannière n'est jamais dans le cache : ce fetch forcé est obligatoire.
    const fetched = await interaction.client.users.fetch(user.id, { force: true }).catch(() => null);
    const url = fetched?.bannerURL({ size: 1024 });

    if (!url) {
      return interaction.reply({ content: `<@${user.id}> n'a pas de bannière.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setAuthor({ name: fetched.tag, iconURL: fetched.displayAvatarURL() })
      .setImage(url);

    await respondPlain(interaction, { embeds: [embed] });
  },
};
